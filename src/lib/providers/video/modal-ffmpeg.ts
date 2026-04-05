/**
 * Modal FFmpeg video composer.
 * POSTs to a Modal-deployed FastAPI endpoint that runs FFmpeg for video composition.
 * FFmpeg on Modal: D-ID full/half layouts or legacy gameplay + drawtext captions → MP4.
 *
 * Required env vars:
 *   MODAL_TOKEN_ID, MODAL_TOKEN_SECRET, MODAL_FFMPEG_URL
 *
 * Deploy: modal deploy modal/video_composer.py → copy URL → set MODAL_FFMPEG_URL
 */
import { nanoid } from "nanoid"
import { getFileStore } from "@/lib/storage"
import type {
  VideoComposer,
  VideoComposeOptions,
  VideoComposeResult,
} from "../types"

export class ModalFFmpegComposer implements VideoComposer {
  private endpoint: string

  constructor() {
    if (!process.env.MODAL_FFMPEG_URL) {
      throw new Error("MODAL_FFMPEG_URL is required for ModalFFmpegComposer")
    }
    this.endpoint = process.env.MODAL_FFMPEG_URL
  }

  async compose(opts: VideoComposeOptions): Promise<VideoComposeResult> {
    const jobId = nanoid(10)
    const rawBackground = opts.backgroundVideoUrl
    const hasTalking = Boolean(opts.talkingVideoUrl?.trim())
    const layout = opts.talkingMode ?? "full"
    // Full-page talking head: omit gameplay — Modal uses only D-ID video + TTS + captions.
    let backgroundAsset: string | undefined
    let backgroundType: string | undefined
    if (hasTalking && layout === "half") {
      if (rawBackground.startsWith("asset:")) backgroundAsset = rawBackground
      if (rawBackground.startsWith("gradient:"))
        backgroundType = rawBackground.slice("gradient:".length)
    } else if (!hasTalking) {
      if (rawBackground.startsWith("asset:")) backgroundAsset = rawBackground
      if (rawBackground.startsWith("gradient:"))
        backgroundType = rawBackground.slice("gradient:".length)
    }

    const tokenId = process.env.MODAL_TOKEN_ID ?? ""
    const tokenSecret = process.env.MODAL_TOKEN_SECRET ?? ""
    const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")

    // When audio bytes are pre-downloaded (private blob), send them inline as base64 so
    // Modal never needs to fetch the blob URL (private Vercel Blob → 403 from external servers).
    const audioBase64 = opts.audioBytes ? opts.audioBytes.toString("base64") : undefined

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        audioUrl: audioBase64 ? undefined : opts.audioUrl,
        audioBase64,
        backgroundAsset,
        backgroundType,
        captions: opts.captions,
        voiceVolumeMultiplier: opts.voiceVolumeMultiplier ?? 1.0,
        talkingVideoUrl: opts.talkingVideoUrl,
        talkingMode: opts.talkingMode,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      let detail = text
      try {
        const parsed = JSON.parse(text) as { detail?: string | string[] }
        if (parsed?.detail != null) {
          detail = Array.isArray(parsed.detail)
            ? parsed.detail.join(", ")
            : String(parsed.detail)
        }
      } catch {
        /* not JSON */
      }
      throw new Error(`Modal FFmpeg request failed: ${response.status} ${detail}`)
    }

    const composeMode = response.headers.get("X-Trollmax-Compose-Mode")
    if (opts.talkingVideoUrl?.trim()) {
      if (!composeMode) {
        throw new Error(
          "Modal FFmpeg did not return X-Trollmax-Compose-Mode. Redeploy `modal deploy modal/video_composer.py` so talking-head fields are supported, then restart Next.js."
        )
      }
      if (!composeMode.startsWith("talking-")) {
        throw new Error(
          `Modal composed "${composeMode}" but a D-ID talking-head URL was sent (expected talking-*). Redeploy modal/video_composer.py and confirm MODAL_FFMPEG_URL points to that app.`
        )
      }
    }

    const buf = Buffer.from(await response.arrayBuffer())
    const fileStore = getFileStore()
    const { url: videoUrl } = await fileStore.upload(`videos/${jobId}.mp4`, buf, "video/mp4")

    return { jobId, status: "complete", videoUrl }
  }

  // Modal is synchronous from Next.js perspective — compose() returns complete directly.
  async getStatus(jobId: string): Promise<VideoComposeResult> {
    return { jobId, status: "complete" }
  }
}
