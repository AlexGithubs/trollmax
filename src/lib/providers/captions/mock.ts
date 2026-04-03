import type { CaptionsProvider } from "../types"
import type { Caption } from "@/lib/manifests/types"

const MOCK_CAPTIONS: Caption[] = [
  { startMs: 0, endMs: 750, text: "Okay so hear me out..." },
  { startMs: 750, endMs: 1600, text: "what if we just cloned that?" },
  { startMs: 1600, endMs: 2400, text: "No cap, full send." },
  { startMs: 2400, endMs: 3000, text: "Trollmax. That's it." },
]

export class MockCaptionsProvider implements CaptionsProvider {
  async transcribe(_audioUrl: string): Promise<Caption[]> {
    return MOCK_CAPTIONS
  }
}
