/**
 * HeyGen talking-head provider.
 *
 * Accepts an image URL + audio URL, uploads both as HeyGen assets, creates a
 * 9:16 portrait video via POST /v3/videos, and polls until done.
 *
 * Drop-in replacement for runDidTalkingHead — identical call signature.
 */

import { downloadBlobBuffer } from "@/lib/storage/blob"
import {
  HeygenCelebrityBlockedError,
  isHeygenCelebrityCode,
} from "@/lib/heygen/heygen-celebrity-error"

const HEYGEN_BASE = "https://api.heygen.com"
const HEYGEN_POLL_INTERVAL_MS = 3_000
/** Max consecutive 5xx status-check failures before giving up. */
const HEYGEN_MAX_POLL_ERRORS = 3
// HeyGen image-to-video commonly needs 1–3 minutes; 120s timed out too often under load.
const HEYGEN_DEFAULT_MAX_WAIT_SEC = 180

/**
 * Wall-clock budget for HeyGen to reach "completed" (ms).
 * Override via HEYGEN_TALK_MAX_WAIT_SEC (30–300, same pattern as DID_TALK_MAX_WAIT_SEC).
 */
function heygenMaxWaitMs(): number {
  const raw = process.env.HEYGEN_TALK_MAX_WAIT_SEC?.trim()
  if (!raw) return HEYGEN_DEFAULT_MAX_WAIT_SEC * 1000
  const sec = Number(raw)
  if (!Number.isFinite(sec) || sec < 30) return HEYGEN_DEFAULT_MAX_WAIT_SEC * 1000
  return Math.min(sec, 300) * 1000
}

export type HeygenPollProgress = {
  attempt: number
  status: string
  elapsedSec: number
}

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "HeyGen is not configured. Set HEYGEN_API_KEY in .env.local (from HeyGen dashboard → API → Keys)."
    )
  }
  return key
}

/**
 * Upload raw bytes to HeyGen /v3/assets.
 * Returns the asset_id to use in subsequent video creation requests.
 */
async function uploadAsset(
  bytes: Buffer,
  mime: string,
  filename: string,
  apiKey: string
): Promise<string> {
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), filename)

  const res = await fetch(`${HEYGEN_BASE}/v3/assets`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `HeyGen asset upload failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
    )
  }

  const json = (await res.json()) as { data?: { asset_id?: string } }
  const assetId = json.data?.asset_id
  if (!assetId) throw new Error("HeyGen asset upload: missing asset_id in response")
  return assetId
}

/**
 * Generate a talking-head video using HeyGen's Image-to-Video endpoint.
 *
 * The image and audio are always downloaded locally and re-uploaded as HeyGen
 * assets — this handles Vercel private blob URLs transparently, the same way
 * the D-ID provider uploads to D-ID's CDN.
 */
export async function runHeygenTalkingHead(input: {
  headshotImageUrl: string
  audioUrl: string
  title: string
  logRef: string
  onPoll?: (progress: HeygenPollProgress) => Promise<void>
}): Promise<string> {
  const apiKey = getApiKey()
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  // Upload image + audio in parallel — HeyGen needs them on its own CDN
  const uploadStarted = Date.now()
  const [imageAssetId, audioAssetId] = await Promise.all([
    (async () => {
      const { buffer, contentType } = await downloadBlobBuffer(input.headshotImageUrl)
      const mime = contentType || "image/jpeg"
      const ext = mime.includes("png") ? "png" : "jpg"
      return uploadAsset(buffer, mime, `headshot.${ext}`, apiKey)
    })(),
    (async () => {
      const { buffer, contentType } = await downloadBlobBuffer(input.audioUrl)
      const mime = contentType || "audio/mpeg"
      const ext = mime.includes("wav") ? "wav" : "mp3"
      return uploadAsset(buffer, mime, `narration.${ext}`, apiKey)
    })(),
  ])
  console.log(
    `[video/generate] HeyGen ${input.logRef} uploads: ${Date.now() - uploadStarted}ms`
  )

  // Create the video
  const createStarted = Date.now()
  const createRes = await fetch(`${HEYGEN_BASE}/v3/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      type: "image",
      image: { type: "asset_id", asset_id: imageAssetId },
      audio_asset_id: audioAssetId,
      title: input.title,
      resolution: "1080p",
      aspect_ratio: "9:16",
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "")
    // Check for celebrity/public-figure content block before surfacing raw error.
    try {
      const errJson = JSON.parse(text) as { error?: { code?: string } }
      if (isHeygenCelebrityCode(errJson.error?.code)) throw new HeygenCelebrityBlockedError()
    } catch (e) {
      if (e instanceof HeygenCelebrityBlockedError) throw e
    }
    throw new Error(
      `HeyGen create video failed: ${createRes.status} ${createRes.statusText}${text ? ` — ${text}` : ""}`
    )
  }

  const createJson = (await createRes.json()) as { data?: { video_id?: string } }
  const videoId = createJson.data?.video_id
  if (!videoId) {
    throw new Error("HeyGen create video: missing video_id in response")
  }

  console.log(
    `[video/generate] HeyGen ${input.logRef} create ${videoId}: ${Date.now() - createStarted}ms`
  )

  // Poll until completed or failed
  const maxWaitMs = heygenMaxWaitMs()
  const pollStartedAt = Date.now()
  let lastStatus = "pending"
  let pollAttempt = 0
  let consecutivePollErrors = 0

  while (Date.now() - pollStartedAt <= maxWaitMs) {
    if (pollAttempt > 0) await sleep(HEYGEN_POLL_INTERVAL_MS)
    pollAttempt++

    if (input.onPoll) {
      await input.onPoll({
        attempt: pollAttempt,
        status: lastStatus,
        elapsedSec: Math.round((Date.now() - pollStartedAt) / 1000),
      })
    }

    const statusRes = await fetch(`${HEYGEN_BASE}/v3/videos/${videoId}`, {
      headers: { "x-api-key": apiKey },
    })

    if (!statusRes.ok) {
      // Absorb transient server-side errors — fail only after N consecutive bad responses.
      if (statusRes.status >= 500 && consecutivePollErrors < HEYGEN_MAX_POLL_ERRORS) {
        consecutivePollErrors++
        console.warn(
          `[video/generate] HeyGen ${input.logRef} ${videoId}: poll returned ${statusRes.status} (${consecutivePollErrors}/${HEYGEN_MAX_POLL_ERRORS}), retrying`
        )
        continue
      }
      const text = await statusRes.text().catch(() => "")
      throw new Error(
        `HeyGen status check failed: ${statusRes.status} ${statusRes.statusText}${text ? ` — ${text}` : ""}`
      )
    }
    consecutivePollErrors = 0

    const statusJson = (await statusRes.json()) as {
      data?: {
        status?: string
        video_url?: string | null
        failure_message?: string | null
        failure_code?: string | null
      }
    }
    const status = statusJson.data?.status ?? lastStatus

    if (status !== lastStatus) {
      const dwellSec = Math.round((Date.now() - pollStartedAt) / 1000)
      console.log(
        `[video/generate] HeyGen ${input.logRef} ${videoId}: ${lastStatus} → ${status} (${dwellSec}s)`
      )
      lastStatus = status
    }

    if (status === "completed") {
      const videoUrl = statusJson.data?.video_url
      if (!videoUrl) throw new Error("HeyGen completed but video_url is missing")
      console.log(
        `[video/generate] HeyGen ${input.logRef} ${videoId}: done in ${Math.round((Date.now() - pollStartedAt) / 1000)}s poll`
      )
      return videoUrl
    }

    if (status === "failed") {
      // Celebrity block can also surface during async processing, not just at create time.
      if (isHeygenCelebrityCode(statusJson.data?.failure_code)) {
        throw new HeygenCelebrityBlockedError()
      }
      const failureCode = statusJson.data?.failure_code ?? "unknown"
      const failureMessage = statusJson.data?.failure_message ?? ""
      // Log the real provider failure so we can diagnose at scale (user sees friendly copy).
      console.error(
        `[video/generate] HeyGen ${input.logRef} ${videoId}: failed code=${failureCode} message=${failureMessage}`
      )
      const msg = failureMessage || failureCode || "HeyGen video generation failed"
      throw new Error(msg)
    }
  }

  throw new Error(
    `HeyGen talking-head timed out after ${Math.round(maxWaitMs / 1000)}s (last status: ${lastStatus}, video id: ${videoId})`
  )
}
