/**
 * Replicate F5-TTS provider.
 * Uses x-lance/f5-tts — canonical SOTA zero-shot voice cloning on Replicate.
 * Accepts an optional ref_text (transcript of the reference audio) which
 * significantly improves speaker similarity when provided.
 *
 * Required env vars:
 *   REPLICATE_API_TOKEN
 */
import Replicate from "replicate"
import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"
import { getFileStore } from "@/lib/storage"
import { nanoid } from "nanoid"

export class ReplicateF5TTSProvider implements TTSProvider {
  private client: Replicate

  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is required for ReplicateF5TTSProvider")
    }
    this.client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  }

  // F5-TTS is zero-shot — reference audio passed per synthesis call.
  // voiceId is the Blob URL of the uploaded speaker sample.
  async clone(opts: CloneOptions): Promise<CloneResult> {
    return { voiceId: opts.sampleAudioUrl }
  }

  async synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult> {
    const output = await this.client.run("x-lance/f5-tts:87faf6dd7a692dd82043f662e76369cab126a2cf1937e25a9d41e0b834fd230e", {
      input: {
        ref_audio: opts.voiceId,
        ref_text: opts.refText ?? "",
        gen_text: opts.text,
        remove_silence: true,
      },
    })

    // Output is a URL string or file object depending on SDK version
    let audioBuffer: Buffer
    if (typeof output === "string") {
      const res = await fetch(output)
      audioBuffer = Buffer.from(await res.arrayBuffer())
    } else if (output && typeof (output as { url?: () => string }).url === "function") {
      const url = (output as { url: () => string }).url()
      const res = await fetch(url)
      audioBuffer = Buffer.from(await res.arrayBuffer())
    } else if (output instanceof ReadableStream) {
      const reader = (output as ReadableStream<Uint8Array>).getReader()
      const chunks: Uint8Array[] = []
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      audioBuffer = Buffer.concat(chunks)
    } else {
      throw new Error(`Unexpected output format from Replicate F5-TTS: ${typeof output}`)
    }

    const fileStore = getFileStore()
    const { url: audioUrl } = await fileStore.upload(
      `clips/${nanoid()}.wav`,
      audioBuffer,
      "audio/wav"
    )

    return { audioUrl, durationSeconds: estimateDuration(audioBuffer.length) }
  }

  async deleteVoice(_voiceId: string): Promise<void> {
    // F5-TTS does not store voice data server-side; no-op
  }
}

/** F5-TTS outputs mono 24000 Hz 16-bit WAV = 48000 bytes/s */
function estimateDuration(bytes: number): number {
  return Math.max(1, Math.round(bytes / 48000))
}
