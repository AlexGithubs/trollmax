import type {
  SoundboardManifest,
  TtsTier,
  VideoManifest,
} from "@/lib/manifests/types"

/** All voice synthesis uses ElevenLabs (presets + instant voice clone). */
export const DEFAULT_TTS_TIER: TtsTier = "elevenlabs"

export function isTtsTier(s: string | undefined | null): s is TtsTier {
  return s === "elevenlabs"
}

/** Always ElevenLabs. Manifest may omit `ttsTier` or store stale values from older builds. */
export function resolveManifestTtsTier(
  _m: Pick<SoundboardManifest, "ttsTier" | "voiceId"> | Pick<VideoManifest, "ttsTier" | "voiceId">
): TtsTier {
  return DEFAULT_TTS_TIER
}
