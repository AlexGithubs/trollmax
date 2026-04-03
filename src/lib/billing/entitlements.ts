import {
  BASE_MAX_PHRASE_CHARS,
  BASE_MAX_PHRASES,
  MAX_SOUNDBOARDS,
  MAX_VIDEOS,
  EXPANDED_MAX_PHRASE_CHARS,
  EXPANDED_MAX_PHRASES,
} from "./config"
import type { TtsTier } from "@/lib/manifests/types"
import { getManifestStore } from "@/lib/storage"
import { getBananaCreditsBalance } from "./banana-credits"

export interface UserEntitlements {
  maxSoundboards: number
  soundboardCount: number
  maxVideos: number
  videoCount: number
  maxPhrases: number
  maxPhraseChars: number
  baseMaxPhrases: number
  baseMaxPhraseChars: number
  bananaCreditsBalance: number
}

export async function getUserEntitlements(
  userId: string
): Promise<UserEntitlements> {
  const store = getManifestStore()
  const [boardIds, videoIds, bananaCreditsBalance] = await Promise.all([
    store.smembers(`user:${userId}:soundboards`),
    store.smembers(`user:${userId}:videos`),
    getBananaCreditsBalance(userId),
  ])
  return {
    maxSoundboards: MAX_SOUNDBOARDS,
    soundboardCount: boardIds.length,
    maxVideos: MAX_VIDEOS,
    videoCount: videoIds.length,
    maxPhrases: EXPANDED_MAX_PHRASES,
    maxPhraseChars: EXPANDED_MAX_PHRASE_CHARS,
    baseMaxPhrases: BASE_MAX_PHRASES,
    baseMaxPhraseChars: BASE_MAX_PHRASE_CHARS,
    bananaCreditsBalance,
  }
}

export function canUsePresetForTier(_presetId: string, _isPro: boolean): boolean {
  return true
}

/** Future: gate premium tiers for add-on pricing. All tiers allowed for now. */
export function canUseTtsTier(_tier: TtsTier, _ent: UserEntitlements): boolean {
  return true
}
