export const FREE_TIER_PRESET_IDS = [
  "rb-demarcus",
  "ra-ziyu",
  "rh-luis",
  "job-farmer",
  "tone-crying",
] as const

export type FreeTierPresetId = (typeof FREE_TIER_PRESET_IDS)[number]

export const MAX_SOUNDBOARDS = 50
export const MAX_VIDEOS = 100
export const BASE_MAX_PHRASES = 6
export const EXPANDED_MAX_PHRASES = 12
export const BASE_MAX_PHRASE_CHARS = 70
export const EXPANDED_MAX_PHRASE_CHARS = 140

export function isFreeTierPreset(presetId: string): boolean {
  return (FREE_TIER_PRESET_IDS as readonly string[]).includes(presetId)
}
