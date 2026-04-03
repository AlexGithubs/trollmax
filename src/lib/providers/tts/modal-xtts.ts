/**
 * Modal XTTS v2 provider.
 * Calls a Modal-deployed endpoint that runs Coqui XTTS v2.
 * Endpoint must accept POST JSON: { text, speaker_wav, language }
 * and return raw audio bytes (wav/mp3).
 *
 * Required env vars:
 *   MODAL_XTTS_URL
 * Optional:
 *   MODAL_TOKEN_ID, MODAL_TOKEN_SECRET (for authenticated endpoints)
 */
import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"
import { getFileStore } from "@/lib/storage"
import { nanoid } from "nanoid"

export class ModalXTTSProvider implements TTSProvider {
  private endpoint: string

  constructor() {
    if (!process.env.MODAL_XTTS_URL) {
      throw new Error("MODAL_XTTS_URL is required for ModalXTTSProvider")
    }
    this.endpoint = process.env.MODAL_XTTS_URL
  }

  // XTTS v2 is zero-shot — voiceId = speaker sample URL
  async clone(opts: CloneOptions): Promise<CloneResult> {
    return { voiceId: opts.sampleAudioUrl }
  }

  async synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET) {
      const cred = Buffer.from(
        `${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`
      ).toString("base64")
      headers["Authorization"] = `Basic ${cred}`
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: opts.text,
        speaker_wav: opts.voiceId,
        language: opts.language ?? "en",
      }),
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Modal XTTS endpoint returned ${res.status}: ${msg}`)
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get("content-type") ?? "audio/wav"
    const ext = contentType.includes("mp3") ? "mp3" : "wav"

    const fileStore = getFileStore()
    const { url: audioUrl } = await fileStore.upload(
      `clips/${nanoid()}.${ext}`,
      audioBuffer,
      contentType
    )

    return { audioUrl, durationSeconds: estimateDuration(audioBuffer.length) }
  }

  async deleteVoice(_voiceId: string): Promise<void> {
    // Modal does not store voice data server-side; no-op
  }
}

function estimateDuration(bytes: number): number {
  return Math.max(1, Math.round(bytes / 88200))
}
