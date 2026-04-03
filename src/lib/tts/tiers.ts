import type {
  SoundboardManifest,
  TtsTier,
  VideoManifest,
} from "@/lib/manifests/types"

export const TTS_TIERS: readonly TtsTier[] = [
  "replicate",
  "elevenlabs",
]

export function isTtsTier(s: string | undefined | null): s is TtsTier {
  return s === "replicate" || s === "elevenlabs"
}

/**
 * Legacy manifests without `ttsTier`: URL voiceId => replicate (F5), else ElevenLabs opaque id.
 */
export function inferLegacyTtsTier(voiceId: string): TtsTier {
  const v = voiceId.trim()
  if (/^https?:\/\//i.test(v)) return "replicate"
  return "elevenlabs"
}

export function resolveManifestTtsTier(
  m: Pick<SoundboardManifest, "ttsTier" | "voiceId"> | Pick<VideoManifest, "ttsTier" | "voiceId">
): TtsTier {
  if (isTtsTier(m.ttsTier)) return m.ttsTier
  return inferLegacyTtsTier(m.voiceId)
}
