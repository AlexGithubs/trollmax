/**
 * Modal Whisper provider stub.
 * Calls a Modal-deployed endpoint that runs OpenAI Whisper (open-source).
 *
 * Required env vars:
 *   MODAL_TOKEN_ID, MODAL_TOKEN_SECRET, MODAL_WHISPER_URL
 *
 * Deploy: see modal/whisper_app.py
 */
import type { CaptionsProvider } from "../types"
import type { Caption } from "@/lib/manifests/types"

export class ModalWhisperProvider implements CaptionsProvider {
  private endpoint: string

  constructor() {
    if (!process.env.MODAL_WHISPER_URL) {
      throw new Error("MODAL_WHISPER_URL is required for ModalWhisperProvider")
    }
    this.endpoint = process.env.MODAL_WHISPER_URL
  }

  async transcribe(_audioUrl: string): Promise<Caption[]> {
    throw new Error(
      "ModalWhisperProvider.transcribe — not yet implemented. Deploy modal/whisper_app.py first."
    )
  }
}
