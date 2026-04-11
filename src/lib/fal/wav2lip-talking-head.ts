/**
 * fal.ai Wav2Lip — image + audio → lip-sync MP4 URL (no D-ID celebrity gate).
 * Pin with FAL_TALKING_HEAD_MODEL=fal-ai/wav2lip or another fal endpoint id.
 *
 * Inputs are always re-uploaded via fal.storage.transformInput so runners fetch
 * from fal CDN only (avoids 403 / bot blocks on arbitrary URLs).
 */
import { fal } from "@fal-ai/client"
import { messageFromFalError } from "@/lib/fal/fal-error"
import { fileFromHttpUrlForFal } from "@/lib/fal/url-for-fal-input"

const DEFAULT_MODEL = "fal-ai/wav2lip"

/** Default bottom pad helps include chin in the face crop (fal Wav2Lip schema example). */
const DEFAULT_PADS: [number, number, number, number] = [0, 10, 0, 0]

function parsePadsEnv(): [number, number, number, number] {
  const raw = process.env.FAL_WAV2LIP_PADS?.trim()
  if (!raw) return DEFAULT_PADS
  const parts = raw.split(/[\s,]+/).map((s) => Number.parseFloat(s.trim()))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return DEFAULT_PADS
  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
}

function parseResizeFactor(): number | undefined {
  const raw = process.env.FAL_WAV2LIP_RESIZE_FACTOR?.trim()
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

function parseQueueStartTimeoutSec(): number {
  const raw = process.env.FAL_QUEUE_START_TIMEOUT_SEC?.trim()
  if (!raw) return 300
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 300
}

export async function falWav2lipTalkingHeadUrl(opts: {
  headshotBlobUrl: string
  audioBlobUrl: string
}): Promise<string> {
  const key = process.env.FAL_KEY?.trim()
  if (!key) {
    throw new Error("FAL_KEY is required for fal talking-head fallback")
  }
  fal.config({ credentials: key })

  const model = process.env.FAL_TALKING_HEAD_MODEL?.trim() || DEFAULT_MODEL

  const faceFile = await fileFromHttpUrlForFal(opts.headshotBlobUrl.trim(), {
    filenameStem: "headshot",
  })
  const audioFile = await fileFromHttpUrlForFal(opts.audioBlobUrl.trim(), {
    filenameStem: "narration",
  })

  const pads = parsePadsEnv()
  const fpsRaw = process.env.FAL_WAV2LIP_FPS?.trim()
  const fps = fpsRaw ? Number.parseFloat(fpsRaw) : 25
  const fpsN = Number.isFinite(fps) ? fps : 25
  const resizeFactor = parseResizeFactor()

  const baseInput: Record<string, unknown> = {
    face_url: faceFile,
    audio_url: audioFile,
    static: true,
    fps: fpsN,
    pads,
  }
  if (resizeFactor !== undefined) baseInput.resize_factor = resizeFactor

  let input: Record<string, unknown>
  try {
    input = (await fal.storage.transformInput(baseInput)) as Record<string, unknown>
  } catch (err) {
    throw new Error(`fal storage upload failed: ${messageFromFalError(err)}`)
  }

  const logs = process.env.FAL_LOGS === "true"
  let result
  try {
    result = await fal.subscribe(model, {
      input,
      logs,
      startTimeout: parseQueueStartTimeoutSec(),
    })
  } catch (err) {
    throw new Error(messageFromFalError(err))
  }

  const data = result.data as { video?: { url?: string } } | null | undefined
  const url = data?.video?.url
  if (!url || typeof url !== "string") {
    throw new Error(
      `fal Wav2Lip returned no video.url (keys: ${data ? Object.keys(data).join(",") : "null"})`
    )
  }
  return url
}
