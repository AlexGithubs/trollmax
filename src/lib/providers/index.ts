import type { TtsTier } from "@/lib/manifests/types"
import type { TTSProvider, CaptionsProvider, VideoComposer } from "./types"
import { MockTTSProvider } from "./tts/mock"
import { MockCaptionsProvider } from "./captions/mock"
import { MockVideoComposer } from "./video/mock"

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true"

/**
 * TTS for a manifest tier (Replicate F5 / ElevenLabs preset or IVC).
 * Use this from generate routes; do not use URL-vs-ID heuristics.
 */
export function getTtsProviderForTier(tier: TtsTier): TTSProvider {
  if (isMock) return new MockTTSProvider()

  switch (tier) {
    case "replicate": {
      if (!process.env.REPLICATE_API_TOKEN?.trim()) {
        throw new Error(
          "REPLICATE_API_TOKEN is required for the Replicate (okay) TTS tier."
        )
      }
      const { ReplicateF5TTSProvider } =
        require("./tts/replicate-f5tts") as typeof import("./tts/replicate-f5tts")
      return new ReplicateF5TTSProvider()
    }
    case "elevenlabs": {
      if (!process.env.ELEVENLABS_API_KEY?.trim()) {
        throw new Error(
          "ELEVENLABS_API_KEY is required for the ElevenLabs (great) TTS tier."
        )
      }
      const { ElevenLabsIVCTTSProvider } =
        require("./tts/elevenlabs-ivc") as typeof import("./tts/elevenlabs-ivc")
      return new ElevenLabsIVCTTSProvider()
    }
    default: {
      const _exhaustive: never = tier
      throw new Error(`Unknown TTS tier: ${_exhaustive}`)
    }
  }
}

/**
 * @deprecated Prefer getTtsProviderForTier from manifest.ttsTier. Used for legacy fallbacks.
 */
export function getTTSProvider(): TTSProvider {
  if (isMock) return new MockTTSProvider()

  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  const hasSamplePipeline = Boolean(
    process.env.MODAL_XTTS_URL || process.env.REPLICATE_API_TOKEN
  )

  if (hasElevenLabs && hasSamplePipeline) {
    const { HybridTTSProvider } =
      require("./tts/hybrid-tts") as typeof import("./tts/hybrid-tts")
    return new HybridTTSProvider()
  }

  if (hasElevenLabs) {
    return getTtsProviderForTier("elevenlabs")
  }

  if (process.env.MODAL_XTTS_URL) {
    const { ModalXTTSProvider } =
      require("./tts/modal-xtts") as typeof import("./tts/modal-xtts")
    return new ModalXTTSProvider()
  }

  if (process.env.REPLICATE_API_TOKEN) {
    return getTtsProviderForTier("replicate")
  }

  throw new Error(
    "No TTS provider configured. Set NEXT_PUBLIC_MOCK_MODE=true or configure ELEVENLABS_API_KEY + REPLICATE_API_TOKEN (or MODAL_XTTS_URL), or sample-only MODAL_XTTS_URL / REPLICATE_API_TOKEN."
  )
}

export function getCaptionsProvider(): CaptionsProvider {
  if (isMock) return new MockCaptionsProvider()

  if (process.env.MODAL_WHISPER_URL) {
    const { ModalWhisperProvider } =
      require("./captions/modal-whisper") as typeof import("./captions/modal-whisper")
    return new ModalWhisperProvider()
  }

  throw new Error(
    "No captions provider configured. Set NEXT_PUBLIC_MOCK_MODE=true or configure MODAL_WHISPER_URL."
  )
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
