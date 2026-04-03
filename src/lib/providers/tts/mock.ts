import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"
import { generateId } from "@/lib/utils"

export class MockTTSProvider implements TTSProvider {
  async clone(_opts: CloneOptions): Promise<CloneResult> {
    return { voiceId: generateId() }
  }

  async synthesize(_opts: SynthesizeOptions): Promise<SynthesizeResult> {
    // Simulate latency
    await new Promise((r) => setTimeout(r, 800))
    return { audioUrl: "/mock-audio.mp3", durationSeconds: 3 }
  }

  async deleteVoice(_voiceId: string): Promise<void> {
    // no-op in mock mode
  }
}
