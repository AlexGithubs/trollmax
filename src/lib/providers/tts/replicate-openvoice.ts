/**
 * Replicate OpenVoice provider stub.
 * Uses the Replicate API to run an OpenVoice community model.
 *
 * Required env vars:
 *   REPLICATE_API_TOKEN
 */
import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"

export class ReplicateOpenVoiceProvider implements TTSProvider {
  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is required for ReplicateOpenVoiceProvider")
    }
  }

  async clone(_opts: CloneOptions): Promise<CloneResult> {
    throw new Error(
      "ReplicateOpenVoiceProvider.clone — not yet implemented."
    )
  }

  async synthesize(_opts: SynthesizeOptions): Promise<SynthesizeResult> {
    throw new Error(
      "ReplicateOpenVoiceProvider.synthesize — not yet implemented."
    )
  }

  async deleteVoice(_voiceId: string): Promise<void> {
    // Replicate does not store voice data server-side; no-op
  }
}
