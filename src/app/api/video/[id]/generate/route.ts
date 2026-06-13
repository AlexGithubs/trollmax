export const maxDuration = 300

import * as Sentry from "@sentry/nextjs"
import { NextResponse, after } from "next/server"
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
import {
  jsonGenerationErrorResponse,
  logGenerationFailure,
} from "@/lib/security/generation-error"
import { isLikelyUpstreamRateLimit, notifyOpsRateLimitEvent } from "@/lib/ops/rate-limit-alert"

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

/** Whether the credentials needed for a given talking-head provider are present. */
function isTalkingHeadProviderConfigured(provider: "heygen" | "did"): boolean {
  if (provider === "heygen") return Boolean(process.env.HEYGEN_API_KEY?.trim())
  return Boolean(
    process.env.DID_API_KEY?.trim() ||
      (process.env.DID_API_USERNAME?.trim() && process.env.DID_API_PASSWORD?.trim())
  )
}

type TalkingHeadInput = {
  headshotImageUrl: string
  audioUrl: string
  title: string
  logRef: string
}

type TalkingHeadProgress = { attempt: number; status: string; elapsedSec: number }

/** Run a single provider, mapping its poll callbacks into manifest progress copy. */
async function runTalkingHeadProvider(
  provider: "heygen" | "did",
  input: TalkingHeadInput,
  updateProgress: (patch: Partial<VideoManifest>) => Promise<void>
): Promise<string> {
  const onPoll = async ({ attempt, status, elapsedSec }: TalkingHeadProgress) => {
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

  const commonInput = { ...input, onPoll }
  console.time(`[video/generate] talking-head:${input.logRef}:${provider}`)
  try {
    return provider === "heygen"
      ? await runHeygenTalkingHead(commonInput)
      : await runDidTalkingHead(commonInput)
  } finally {
    console.timeEnd(`[video/generate] talking-head:${input.logRef}:${provider}`)
  }
}

/** Total attempts for the primary provider before giving up (1 retry for transient failures). */
const PRIMARY_MAX_ATTEMPTS = 2

/** Celebrity blocks and user-input problems are never worth retrying — they'll fail identically. */
function isNonRetryableTalkingHeadError(err: unknown): boolean {
  return (
    isHeygenCelebrityBlockedError(err) ||
    isDidCelebrityBlockedError(err) ||
    isGenerationUserInputError(err)
  )
}

/** A timeout already consumed most of the time budget; a retry won't fit in maxDuration. */
function isTalkingHeadTimeout(err: unknown): boolean {
  return err instanceof Error && /timed out/i.test(err.message)
}

/**
 * D-ID is intentionally NOT used automatically. Its output quality is noticeably worse,
 * so we prefer to fail (and let the user retry HeyGen) rather than silently ship a D-ID
 * render. The integration stays in the codebase as an emergency backup that an operator
 * can re-enable by setting TALKING_HEAD_DID_FALLBACK=true.
 */
function isDidFallbackEnabled(): boolean {
  return process.env.TALKING_HEAD_DID_FALLBACK?.trim().toLowerCase() === "true"
}

/**
 * Run the primary talking-head provider (HeyGen by default), retrying once on transient
 * failures. The D-ID fallback is opt-in only (TALKING_HEAD_DID_FALLBACK=true); by default
 * an exhausted HeyGen run fails so the user can retry rather than receiving a D-ID video.
 * Provider failures are reported to Sentry with the real error for diagnosis.
 */
async function runTalkingHeadWithFallback(
  input: TalkingHeadInput,
  updateProgress: (patch: Partial<VideoManifest>) => Promise<void>
): Promise<string> {
  const primary = getTalkingHeadProvider()
  const maxAttempts = primary === "heygen" ? PRIMARY_MAX_ATTEMPTS : 1
  let lastErr: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await runTalkingHeadProvider(primary, input, updateProgress)
    } catch (err) {
      lastErr = err
      if (isNonRetryableTalkingHeadError(err)) throw err
      const canRetry = attempt < maxAttempts && !isTalkingHeadTimeout(err)
      console.error(
        `[video/generate] ${primary} talking-head attempt ${attempt}/${maxAttempts} failed for ${input.logRef}${canRetry ? " — retrying" : ""}:`,
        err
      )
      Sentry.captureException(err, {
        tags: { stage: "talking-head", provider: primary, attempt: String(attempt) },
        extra: { logRef: input.logRef },
      })
      if (!canRetry) break
      await updateProgress({
        progressStep: "Hit a snag — retrying talking head…",
        progressDetail: `${primary} · retry ${attempt + 1}`,
      })
    }
  }

  // Optional emergency backup (disabled by default; see isDidFallbackEnabled).
  const secondary: "heygen" | "did" = primary === "heygen" ? "did" : "heygen"
  const backupAllowed = secondary === "did" ? isDidFallbackEnabled() : true
  if (backupAllowed && isTalkingHeadProviderConfigured(secondary)) {
    console.error(
      `[video/generate] ${primary} exhausted for ${input.logRef}; falling back to ${secondary}:`,
      lastErr
    )
    Sentry.captureException(lastErr, {
      tags: { stage: "talking-head", provider: primary, fallback: secondary },
      extra: { logRef: input.logRef },
    })
    await updateProgress({
      progressStep: "Retrying talking head with a backup renderer…",
      progressDetail: `${secondary} · retry`,
    })
    return await runTalkingHeadProvider(secondary, input, updateProgress)
  }

  throw lastErr
}

/** Friendly, provider-agnostic copy for a talking-head failure that exhausted fallbacks. */
function friendlyTalkingHeadMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.startsWith("D-ID")) return userMessageFromDidFailure(err)
  return userMessageFromHeygenFailure(err)
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

  const releaseLock = () => store.del(lockKey).catch(() => {})
  const generationCost = videoGenerationCostBananaCredits(manifest.script.length)

  let processing: VideoManifest
  let balanceAfterDebit: number
  try {
    const canAfford = await canAffordBananaCredits(user.id, generationCost)
    if (!canAfford) {
      const balance = await getBananaCreditsBalance(user.id)
      await releaseLock()
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
      await releaseLock()
      return NextResponse.json(manifest)
    }

    const now = new Date().toISOString()
    const manifestSnapshot = { ...manifest }

    // Mark as processing
    processing = {
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
      await releaseLock()
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
    balanceAfterDebit = debit.balance
  } catch (setupErr) {
    await releaseLock()
    return jsonGenerationErrorResponse("video/generate:setup", setupErr)
  }

  // Run the heavy pipeline AFTER the response is sent so it survives client
  // disconnects (mobile backgrounding, navigation, flaky networks). The client
  // polls the status endpoint for progress and the final result.
  after(async () => {
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
        const [words, talkingUrl] = await Promise.all([
          captionsEnabled
            ? transcribeForCaptions(audioUrl)
            : Promise.resolve([] as Awaited<ReturnType<typeof transcribeForCaptions>>),
          runTalkingHeadWithFallback(
            {
              headshotImageUrl: manifest.headshotImageUrl!,
              audioUrl,
              title: manifest.title,
              logRef: id,
            },
            updateProgress
          ),
        ])
        transcriptWords = words
        talkingVideoUrl = talkingUrl
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
        // Raw provider error → server logs + Sentry for diagnosis; users see friendly copy only.
        console.error(`[video/generate] parallel pipeline failed (${id}): ${msg}`, parallelErr)
        Sentry.captureException(parallelErr, {
          tags: { stage: "talking-head", outcome: "exhausted" },
          extra: { logRef: id, rawError: msg },
        })
        throw new GenerationUserInputError(friendlyTalkingHeadMessage(parallelErr))
      } finally {
        console.timeEnd(`[video/generate] parallel:${id}`)
      }

      if (captionsEnabled) {
        await updateProgress({ progressStep: "Building captions…", progressPct: 70 })
        captions = buildCaptions(transcriptWords, manifest.script, audioDurationMs)
      }
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

    // The headshot was only needed by the talking-head providers and is not referenced
    // by the composed video. Delete it only now that the whole pipeline has succeeded —
    // keeping it until success means a failed run can be retried without re-uploading.
    if (manifest.headshotImageUrl) {
      await getFileStore().delete(manifest.headshotImageUrl).catch((err) => {
        console.warn("[video/generate] headshot blob cleanup failed:", err)
      })
    }
    console.timeEnd(`[video/generate] pipeline:${id}`)
  } catch (err) {
    // Refund credits so users are not charged for pipeline failures (D-ID timeout, Modal crash, etc.)
    await creditBananaCredits(user.id, generationCost).catch((refundErr) => {
      console.error("[video/generate] credit refund failed:", refundErr)
    })
    // Keep the headshot (do NOT delete or clear it) so the user can retry this manifest
    // without re-uploading. It is cleaned up on eventual success, or when the video is deleted.
    const failed: VideoManifest = {
      ...manifest,
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
    logGenerationFailure("video/generate:pipeline", err, { id })
    if (isLikelyUpstreamRateLimit(err)) {
      notifyOpsRateLimitEvent({
        kind: "upstream",
        source: "video/generate:pipeline",
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  } finally {
      await releaseLock()
    }
  })

  return NextResponse.json(
    {
      ...processing,
      bananaCreditsCharged: generationCost,
      bananaCreditsBalance: balanceAfterDebit,
    },
    { status: 202 }
  )
}
