/**
 * Preset voices (opaque ElevenLabs voice IDs) → ElevenLabs.
 * Uploaded samples (voiceId is an https URL) → Replicate F5-TTS when
 * REPLICATE_API_TOKEN is set, else Modal XTTS (Replicate first — matches the
 * pre–ElevenLabs upload pipeline).
 */
import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"
import { ElevenLabsTTSProvider } from "./elevenlabs"

function isRefAudioUrl(voiceId: string): boolean {
  return /^https?:\/\//i.test(voiceId.trim())
}

export class HybridTTSProvider implements TTSProvider {
  private readonly sample: TTSProvider
  private elevenLabs: ElevenLabsTTSProvider | null = null

  constructor() {
    if (process.env.REPLICATE_API_TOKEN) {
      const { ReplicateF5TTSProvider } =
        require("./replicate-f5tts") as typeof import("./replicate-f5tts")
      this.sample = new ReplicateF5TTSProvider()
    } else if (process.env.MODAL_XTTS_URL) {
      const { ModalXTTSProvider } =
        require("./modal-xtts") as typeof import("./modal-xtts")
      this.sample = new ModalXTTSProvider()
    } else {
      throw new Error(
        "Hybrid TTS: set REPLICATE_API_TOKEN or MODAL_XTTS_URL for uploaded voice samples (ElevenLabs is presets-only)."
      )
    }
  }

  private getElevenLabs(): ElevenLabsTTSProvider {
    if (!this.elevenLabs) {
      this.elevenLabs = new ElevenLabsTTSProvider()
    }
    return this.elevenLabs
  }

  async clone(opts: CloneOptions): Promise<CloneResult> {
    return this.sample.clone(opts)
  }

  async synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult> {
    if (isRefAudioUrl(opts.voiceId)) {
      return this.sample.synthesize(opts)
    }
    return this.getElevenLabs().synthesize(opts)
  }

  async deleteVoice(voiceId: string): Promise<void> {
    await this.sample.deleteVoice(voiceId)
    if (!isRefAudioUrl(voiceId) && this.elevenLabs) {
      await this.elevenLabs.deleteVoice(voiceId)
    }
  }
}
