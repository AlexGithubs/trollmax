export const maxDuration = 300

import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore, getFileStore } from "@/lib/storage"
import { downloadBlobBuffer, isPrivateVercelBlobUrl } from "@/lib/storage/blob"
import { runDidTalkingHead } from "@/lib/d-id/run-did-talking-head"
import { runHeygenTalkingHead } from "@/lib/heygen/run-heygen-talking-head"
import { userMessageFromHeygenFailure } from "@/lib/heygen/user-message-from-heygen-error"
import { getVideoComposer } from "@/lib/providers"
import { resolveVideoVoiceForGenerate } from "@/lib/tts/resolve-voice-for-generate"
import { checkRateLimit } from "@/lib/rate-limit"
import { buildCaptions } from "@/lib/video/captions"
import { transcribeForCaptions } from "@/lib/video/transcribe-for-captions"
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
import { isDidCelebrityBlockedError } from "@/lib/d-id/did-celebrity-error"
import { isHeygenCelebrityBlockedError } from "@/lib/heygen/heygen-celebrity-error"
import { userMessageFromDidFailure } from "@/lib/d-id/user-message-from-did-error"
import {
  GenerationCapabilityUnavailableError,
  GenerationUserInputError,
  isGenerationCapabilityUnavailableError,
  isGenerationUserInputError,
} from "@/lib/generation/errors"
import { jsonGenerationErrorResponse } from "@/lib/security/generation-error"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MODAL_TIMEOUT_RE = /modal ffmpeg request failed:\s*500[\s\S]*function execution timed out/i

function isModalComposeTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return MODAL_TIMEOUT_RE.test(err.message)
}

/**
 * Selects the talking-head provider based on TALKING_HEAD_PROVIDER env var.
 * Defaults to "did" when unset so the existing D-ID path is unchanged.
 * Set TALKING_HEAD_PROVIDER=heygen to route through HeyGen instead.
 */
function getTalkingHeadProvider(): "heygen" | "did" {
  const val = process.env.TALKING_HEAD_PROVIDER?.trim().toLowerCase()
  return val === "heygen" ? "heygen" : "did"
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
    lastErrorCode: undefined,
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
    console.time(`[video/generate] pipeline:${id}`)
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
    const { audioUrl, durationSeconds } = await synth.provider.synthesize({
      voiceId: synth.voiceId,
      text: scriptForSpeech,
      ...(synth.refText ? { refText: synth.refText } : {}),
    })
    const audioDurationMs = Math.max(1000, Math.round(durationSeconds * 1000))
    // Pre-download audio bytes when the blob is private so Modal doesn't need to fetch
    // the blob URL itself (private Vercel blobs require auth; Modal has no token).
    let audioBytes: Buffer | undefined
    if (isPrivateVercelBlobUrl(audioUrl)) {
      const { buffer } = await downloadBlobBuffer(audioUrl)
      audioBytes = buffer
    }

    const captionsEnabled = manifest.captionsEnabled === true
    let captions = [] as VideoManifest["captions"]
    let talkingVideoUrl: string | undefined
    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true"

    // ── Steps 2–4 (parallel): Whisper + D-ID ───────────────────────────────────
    await updateProgress({
      progressStep: isMock
        ? "Preparing video…"
        : "Transcribing + creating talking head (parallel)…",
      progressPct: 30,
    })

    if (isMock) {
      if (captionsEnabled) {
        captions = buildCaptions([], manifest.script, audioDurationMs)
      }
    } else {
      if (!manifest.headshotImageUrl) {
        throw new Error("Missing headshotImageUrl in manifest")
      }
      if (manifest.talkingMode !== "full" && manifest.talkingMode !== "half") {
        throw new Error("Missing/invalid talkingMode in manifest")
      }

      console.time(`[video/generate] parallel:${id}`)
      let transcriptWords: Awaited<ReturnType<typeof transcribeForCaptions>> = []

      try {
        const [words, didUrl] = await Promise.all([
          captionsEnabled
            ? transcribeForCaptions(audioUrl)
            : Promise.resolve([] as Awaited<ReturnType<typeof transcribeForCaptions>>),
          (async () => {
            const provider = getTalkingHeadProvider()
            console.time(`[video/generate] talking-head:${id}`)
            try {
              const onPoll = async ({
                attempt,
                status,
                elapsedSec,
              }: {
                attempt: number
                status: string
                elapsedSec: number
              }) => {
                // Normalise status strings from both providers into user-facing copy.
                // D-ID:    created | started | processing | done | error
                // HeyGen:  pending | processing | completed | failed
                const step =
                  status === "created" || status === "pending"
                    ? "Queued at provider…"
                    : status === "started" || status === "processing"
                      ? provider === "heygen"
                        ? "Rendering talking head (~1–2 min)…"
                        : "Rendering talking head…"
                      : "Creating talking head…"
                await updateProgress({
                  progressStep: step,
                  progressPct: Math.min(75, 45 + Math.round(elapsedSec / 2)),
                  progressDetail: `${provider} · ${status} · ${elapsedSec}s · poll ${attempt}`,
                })
              }

              const commonInput = {
                headshotImageUrl: manifest.headshotImageUrl!,
                audioUrl,
                title: manifest.title,
                logRef: id,
                onPoll,
              }

              return provider === "heygen"
                ? await runHeygenTalkingHead(commonInput)
                : await runDidTalkingHead(commonInput)
            } finally {
              console.timeEnd(`[video/generate] talking-head:${id}`)
            }
          })(),
        ])
        transcriptWords = words
        talkingVideoUrl = didUrl
      } catch (parallelErr) {
        if (isGenerationUserInputError(parallelErr)) throw parallelErr
        if (isDidCelebrityBlockedError(parallelErr) || isHeygenCelebrityBlockedError(parallelErr)) {
          throw new GenerationCapabilityUnavailableError()
        }
        const msg = parallelErr instanceof Error ? parallelErr.message : String(parallelErr)
        // Re-throw provider misconfiguration errors as-is so ops can see the real message.
        if (
          msg.includes("D-ID is not configured") ||
          msg.includes("HeyGen is not configured")
        ) {
          throw parallelErr
        }
        console.error(`[video/generate] parallel pipeline failed (${id}):`, parallelErr)
        // Route to provider-specific user-facing message so copy never mentions the wrong provider.
        const provider = getTalkingHeadProvider()
        const friendly =
          provider === "heygen"
            ? userMessageFromHeygenFailure(parallelErr)
            : userMessageFromDidFailure(parallelErr)
        throw new GenerationUserInputError(friendly)
      } finally {
        console.timeEnd(`[video/generate] parallel:${id}`)
      }

      if (captionsEnabled) {
        await updateProgress({ progressStep: "Building captions…", progressPct: 70 })
        captions = buildCaptions(transcriptWords, manifest.script, audioDurationMs)
      }
    }

    // Headshot was only needed for talking-head providers. Delete it immediately — it is no longer
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
      // Modal fetches this only when audioBytes is unset (public or non-Vercel URLs).
      audioUrl: audioBytes ? undefined : audioUrl,
      ...(audioBytes ? { audioBytes } : {}),
      backgroundVideoUrl: getBackgroundAsset(manifest.backgroundVideoId, id),
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
      ...(composeResult.thumbnailUrl ? { thumbnailUrl: composeResult.thumbnailUrl } : {}),
      headshotImageUrl: "",  // blob was deleted above; clear URL from manifest
      progressStep: "Complete",
      progressPct: 100,
      progressDetail: null as unknown as undefined,
      lastError: undefined,
      lastErrorCode: undefined,
      unseenCompletion: true,
      updatedAt: new Date().toISOString(),
    }
    await store.set(`video:${id}`, JSON.stringify(completed))
    console.timeEnd(`[video/generate] pipeline:${id}`)
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
      lastErrorCode: isGenerationCapabilityUnavailableError(err)
        ? "GENERATION_CAPABILITY_UNAVAILABLE"
        : isGenerationUserInputError(err)
          ? "GENERATION_USER_INPUT"
          : undefined,
      updatedAt: new Date().toISOString(),
    }
    await store.set(`video:${id}`, JSON.stringify(failed))
    return jsonGenerationErrorResponse("video/generate:pipeline", err)
  }
  } finally {
    await store.del(lockKey).catch(() => {})
  }
}
