import type { TtsTier } from "@/lib/manifests/types"
import { GenerationConfigError } from "@/lib/generation/errors"
import type { TTSProvider, VideoComposer } from "./types"
import { MockTTSProvider } from "./tts/mock"
import { MockVideoComposer } from "./video/mock"

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true"

/**
 * TTS — ElevenLabs presets and instant voice clone only.
 */
export function getTtsProviderForTier(_tier: TtsTier): TTSProvider {
  if (isMock) return new MockTTSProvider()

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    throw new GenerationConfigError(
      "ELEVENLABS_API_KEY is required for voice synthesis."
    )
  }
  const { ElevenLabsIVCTTSProvider } =
    require("./tts/elevenlabs-ivc") as typeof import("./tts/elevenlabs-ivc")
  return new ElevenLabsIVCTTSProvider()
}

export function getVideoComposer(): VideoComposer {
  if (isMock) return new MockVideoComposer()

  if (process.env.MODAL_FFMPEG_URL) {
    const { ModalFFmpegComposer } =
      require("./video/modal-ffmpeg") as typeof import("./video/modal-ffmpeg")
    return new ModalFFmpegComposer()
  }

  throw new Error(
    "No video composer configured. Set NEXT_PUBLIC_MOCK_MODE=true or configure MODAL_FFMPEG_URL."
  )
}
