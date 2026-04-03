export const maxDuration = 300

import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import Replicate from "replicate"
import { getManifestStore, getFileStore } from "@/lib/storage"
import { blobUrlForExternalFetch } from "@/lib/storage/blob"
import { didAudioUrlFromBlobUrl } from "@/lib/d-id/upload-audio-for-talk"
import { didSourceUrlFromHeadshotBuffer } from "@/lib/d-id/upload-headshot-for-talk"
import { getVideoComposer } from "@/lib/providers"
import { resolveVideoVoiceForGenerate } from "@/lib/tts/resolve-voice-for-generate"
import { checkRateLimit } from "@/lib/rate-limit"
import { parseWhisperXWords } from "@/lib/audio/match-phrases"
import type { TranscriptWord } from "@/lib/audio/match-phrases"
import { buildCaptions } from "@/lib/video/captions"
import { getBackgroundAsset } from "@/lib/video/backgrounds"
import { normalizeTextForTTS } from "@/lib/text/tts-normalize"
import type { VideoManifest } from "@/lib/manifests/types"
import { getVoicePresetVolumeMultiplier } from "@/lib/voice-presets/voice-volume"
import {
  canAffordBananaCredits,
  getBananaCreditsBalance,
  tryDebitBananaCredits,
  creditBananaCredits,
} from "@/lib/billing/banana-credits"
import { videoGenerationCostBananaCredits } from "@/lib/billing/video-generation-cost"
import { jsonGenerationErrorResponse } from "@/lib/security/generation-error"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MODAL_TIMEOUT_RE = /modal ffmpeg request failed:\s*500[\s\S]*function execution timed out/i

function isModalComposeTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return MODAL_TIMEOUT_RE.test(err.message)
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "generate")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const manifest = JSON.parse(raw) as VideoManifest
  if (manifest.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Atomic generation lock — prevents concurrent double-debit (TOCTOU race condition).
  // Two simultaneous POSTs could both pass the affordability check before either debits.
  const lockKey = `generate_lock:video:${id}`
  const lockAcquired = typeof store.setNX === "function" ? await store.setNX(lockKey, 660) : true
  if (!lockAcquired) {
    if (manifest.status === "processing") return NextResponse.json(manifest)
    return NextResponse.json({ error: "Generation already in progress. Please wait." }, { status: 409 })
  }

  try {
  const generationCost = videoGenerationCostBananaCredits(manifest.script.length)
  const canAfford = await canAffordBananaCredits(user.id, generationCost)
  if (!canAfford) {
    const balance = await getBananaCreditsBalance(user.id)
    return NextResponse.json(
      {
        error: "Insufficient banana credits.",
        code: "INSUFFICIENT_BANANA_CREDITS",
        required: generationCost,
        balance,
      },
      { status: 402 }
    )
  }

  // Idempotency guard
  if (manifest.status === "processing") {
    return NextResponse.json(manifest)
  }

  const now = new Date().toISOString()
  const manifestSnapshot = { ...manifest }

  // Mark as processing
  const processing: VideoManifest = {
    ...manifest,
    status: "processing",
    progressStep: "Starting…",
    progressPct: 0,
    progressDetail: null as unknown as undefined,
    lastError: undefined,
    updatedAt: now,
  }
  await store.set(`video:${id}`, JSON.stringify(processing))

  const debit = await tryDebitBananaCredits(user.id, generationCost)
  if (!debit.ok) {
    await store.set(`video:${id}`, JSON.stringify({ ...manifestSnapshot, updatedAt: new Date().toISOString() }))
    return NextResponse.json(
      {
        error: "Insufficient banana credits.",
        code: "INSUFFICIENT_BANANA_CREDITS",
        required: generationCost,
        balance: debit.balance,
      },
      { status: 402 }
    )
  }
  const balanceAfterDebit = debit.balance

  try {
    const updateProgress = async (patch: Partial<VideoManifest>) => {
      const raw2 = await store.get(`video:${id}`)
      if (!raw2) return
      const cur = JSON.parse(raw2) as VideoManifest
      await store.set(`video:${id}`, JSON.stringify({ ...cur, ...patch, updatedAt: new Date().toISOString() }))
    }

    // ── Step 1: TTS — synthesize full script ──────────────────────────────────
    await updateProgress({ progressStep: "Synthesizing narration audio…", progressPct: 10 })
    const rawTts = await store.get(`video:${id}`)
    if (!rawTts) throw new Error("Manifest missing during TTS")
    const manifestForTts = JSON.parse(rawTts) as VideoManifest
    const persist = async (next: VideoManifest) => {
      await store.set(`video:${id}`, JSON.stringify(next))
    }
    const synth = await resolveVideoVoiceForGenerate(manifestForTts, persist)
    const scriptForSpeech = normalizeTextForTTS(manifestForTts.script)
    const { audioUrl } = await synth.provider.synthesize({
      voiceId: synth.voiceId,
      text: scriptForSpeech,
      ...(synth.refText ? { refText: synth.refText } : {}),
    })
    const audioUrlForFetch = await blobUrlForExternalFetch(audioUrl)

    const captionsEnabled = manifest.captionsEnabled !== false
    let captions = [] as VideoManifest["captions"]
    if (captionsEnabled) {
      // ── Step 2: Whisper — word-level timestamps (non-fatal) ─────────────────
      await updateProgress({ progressStep: "Running speech transcription…", progressPct: 25 })
      let transcriptWords: TranscriptWord[] = []
      if (process.env.REPLICATE_API_TOKEN) {
        try {
          const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
          const result = await replicate.run(
            "thomasmol/whisper-diarization:1495a9cddc83b2203b0d8d3516e38b80fd1572ebc4bc5700ac1da56a9b3ed886",
            {
              input: {
                file_url: audioUrlForFetch,
                language: "en",
              },
            }
          )
          transcriptWords = parseWhisperXWords(result)
          console.log(`[video/generate] Transcription found ${transcriptWords.length} words`)
        } catch (err) {
          console.warn("[video/generate] Whisper failed, using fallback captions:", err)
        }
      }

      // ── Step 3: Build captions ──────────────────────────────────────────────
      await updateProgress({ progressStep: "Building captions…", progressPct: 35 })
      captions = buildCaptions(transcriptWords, manifest.script)
    } else {
      await updateProgress({
        progressStep: "Captions disabled — skipping transcript/caption step…",
        progressPct: 35,
      })
    }

    // ── Step 4: D-ID talking head video ──────────────────────────────────────────
    await updateProgress({ progressStep: "Creating talking head (D-ID)…", progressPct: 45 })
    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true"
    let talkingVideoUrl: string | undefined

    if (!isMock) {
      console.time(`[video/generate] d-id:${id}`)
      if (!manifest.headshotImageUrl) {
        throw new Error("Missing headshotImageUrl in manifest")
      }
      if (manifest.talkingMode !== "full" && manifest.talkingMode !== "half") {
        throw new Error("Missing/invalid talkingMode in manifest")
      }

      let didUsername = process.env.DID_API_USERNAME ?? ""
      let didPassword = process.env.DID_API_PASSWORD ?? ""
      didUsername = didUsername.trim()
      didPassword = didPassword.trim()

      // D-ID Studio key is typically provided as a single `API_USERNAME:API_PASSWORD` string.
      // We accept that format too to reduce friction.
      if (!didPassword && didUsername.includes(":")) {
        const [u, ...rest] = didUsername.split(":")
        didUsername = u
        didPassword = rest.join(":")
      }

      if (!didUsername || !didPassword) {
        throw new Error(
          "D-ID is not configured. Provide DID_API_USERNAME + DID_API_PASSWORD from your D-ID Studio key."
        )
      }

      // Per D-ID docs, Authorization header is `Basic API_USERNAME:API_PASSWORD` (not base64).
      const didAuthHeader = `Basic ${didUsername}:${didPassword}`

      const headshotForDid = await didSourceUrlFromHeadshotBuffer(
        manifest.headshotImageUrl,
        didAuthHeader
      )
      const audioUrlForDid = await didAudioUrlFromBlobUrl(audioUrl, didAuthHeader)

      const createRes = await fetch("https://api.d-id.com/talks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: didAuthHeader,
        },
        body: JSON.stringify({
          source_url: headshotForDid,
          script: {
            type: "audio",
            audio_url: audioUrlForDid,
            subtitles: false,
          },
          name: manifest.title,
          config: {
            result_format: "mp4",
            // Composites the animated face back onto the full source image (wider shot) instead of a tight face crop.
            // Some accounts may need stitch permission; set DID_STITCH=false to disable if the API returns 403.
            ...(process.env.DID_STITCH !== "false" ? { stitch: true } : {}),
          },
        }),
      })

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => "")
        throw new Error(
          `D-ID create talk failed: ${createRes.status} ${createRes.statusText}${text ? ` — ${text}` : ""}`
        )
      }

      const createJson = (await createRes.json()) as {
        id?: string
        status?: string
      }
      const didTalkId = createJson.id
      if (!didTalkId) throw new Error("D-ID create talk failed: missing id")

      // Poll until done (D-ID typically takes 10-30s)
      let didStatus = createJson.status ?? "created"
      let resultUrl: string | undefined
      const startedAt = Date.now()

      for (let attempt = 0; attempt < 120; attempt++) {
        if (attempt % 2 === 0) {
          await updateProgress({
            progressStep: "Creating talking head (D-ID)…",
            progressPct: 55,
            progressDetail: `Polling D-ID… (${attempt + 1})`,
          })
        }
        const statusRes = await fetch(`https://api.d-id.com/talks/${didTalkId}`, {
          method: "GET",
          headers: {
            Authorization: didAuthHeader,
          },
        })

        if (!statusRes.ok) {
          const text = await statusRes.text().catch(() => "")
          throw new Error(
            `D-ID status check failed: ${statusRes.status} ${statusRes.statusText}${text ? ` — ${text}` : ""}`
          )
        }

        const statusJson = (await statusRes.json()) as {
          status?: string
          result_url?: string
          error_message?: string
          message?: string
        }

        didStatus = statusJson.status ?? didStatus
        if (didStatus === "done") {
          resultUrl = statusJson.result_url
          break
        }
        if (didStatus === "error" || didStatus === "rejected") {
          throw new Error(statusJson.error_message ?? statusJson.message ?? `D-ID failed: ${didStatus}`)
        }

        // Hard timeout safety net.
        if (Date.now() - startedAt > 2 * 60 * 1000) {
          throw new Error("D-ID talking-head generation timed out")
        }

        await sleep(2000)
      }

      if (!resultUrl) {
        throw new Error("D-ID talking-head generation completed but no result_url returned")
      }
      talkingVideoUrl = resultUrl
      console.timeEnd(`[video/generate] d-id:${id}`)
    }

    // Headshot was only needed for D-ID. Delete it immediately — it is no longer
    // referenced by the composed video and should not remain permanently public.
    if (manifest.headshotImageUrl) {
      await getFileStore().delete(manifest.headshotImageUrl).catch((err) => {
        console.warn("[video/generate] headshot blob cleanup failed:", err)
      })
    }

    // ── Step 5: Compose final video (layout + captions) ────────────────────────
    await updateProgress({ progressStep: "Compositing + captions (FFmpeg)…", progressPct: 80, progressDetail: null as unknown as undefined })
    const composer = getVideoComposer()
    const voiceVolumeMultiplier = getVoicePresetVolumeMultiplier(
      manifest.voicePresetId
    )
    const composeOpts = {
      audioUrl: audioUrlForFetch,
      backgroundVideoUrl: getBackgroundAsset(manifest.backgroundVideoId),
      captions,
      outputFormat: "mp4" as const,
      resolution: "1080x1920" as const,
      talkingVideoUrl,
      talkingMode: manifest.talkingMode,
      ...(voiceVolumeMultiplier !== 1 ? { voiceVolumeMultiplier } : {}),
    }

    console.time(`[video/generate] compose:${id}`)
    let composeResult
    try {
      composeResult = await composer.compose(composeOpts)
    } catch (err) {
      console.timeEnd(`[video/generate] compose:${id}`)
      if (!isModalComposeTimeout(err)) throw err
      throw new Error(
        "Video composition timed out on Modal while rendering captions/talking-head. Redeploy `modal/video_composer.py` with higher timeout and confirm `MODAL_FFMPEG_URL` points to the latest deployment."
      )
    }
    console.timeEnd(`[video/generate] compose:${id}`)

    // Poll until complete (handles async mock; real Modal returns complete immediately)
    let attempts = 0
    while (
      (composeResult.status === "queued" || composeResult.status === "processing") &&
      attempts < 60
    ) {
      await sleep(2000)
      composeResult = await composer.getStatus(composeResult.jobId)
      attempts++
    }

    if (composeResult.status !== "complete" || !composeResult.videoUrl) {
      throw new Error(composeResult.errorMessage ?? "Video composition timed out or failed")
    }

    // ── Step 5: Save completed manifest ──────────────────────────────────────
    const completed: VideoManifest = {
      ...manifest,
      status: "complete",
      audioUrl,
      captions,
      jobId: composeResult.jobId,
      videoUrl: composeResult.videoUrl,
      headshotImageUrl: "",  // blob was deleted above; clear URL from manifest
      progressStep: "Complete",
      progressPct: 100,
      progressDetail: null as unknown as undefined,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }
    await store.set(`video:${id}`, JSON.stringify(completed))
    return NextResponse.json({
      ...completed,
      bananaCreditsCharged: generationCost,
      bananaCreditsBalance: balanceAfterDebit,
    })
  } catch (err) {
    // Refund credits so users are not charged for pipeline failures (D-ID timeout, Modal crash, etc.)
    await creditBananaCredits(user.id, generationCost).catch((refundErr) => {
      console.error("[video/generate] credit refund failed:", refundErr)
    })
    // Best-effort headshot cleanup on failure (may already be deleted if D-ID succeeded before compose failed)
    if (manifest.headshotImageUrl) {
      await getFileStore().delete(manifest.headshotImageUrl).catch(() => {})
    }
    const failed: VideoManifest = {
      ...manifest,
      headshotImageUrl: "",
      status: "failed",
      progressStep: "Failed",
      progressPct: 100,
      lastError: err instanceof Error ? err.message : String(err),
      updatedAt: new Date().toISOString(),
    }
    await store.set(`video:${id}`, JSON.stringify(failed))
    return jsonGenerationErrorResponse("video/generate:pipeline", err)
  }
  } finally {
    await store.del(lockKey).catch(() => {})
  }
}
