/**
 * Server-allowlisted preset voices. Active presets resolve ElevenLabs voice IDs from env
 * (see providerVoiceIdEnv). Legacy refAudioUrl/refText apply when using F5-TTS / XTTS.
 */

import { GenerationConfigError } from "@/lib/generation/errors"
import { VOICE_PRESET_CATEGORIES, type VoicePresetCategory } from "./categories"
import { VOICE_PRESET_ENTRIES } from "./presets-data"
import type { VoicePreset, VoicePresetPublic } from "./types"

export type { VoicePreset, VoicePresetPublic, VoicePresetCategory }

const PRESETS: VoicePreset[] = [...VOICE_PRESET_ENTRIES].sort((a, b) => {
  const ca =
    VOICE_PRESET_CATEGORIES.find((c) => c.id === a.categoryId)?.sortOrder ?? 999
  const cb =
    VOICE_PRESET_CATEGORIES.find((c) => c.id === b.categoryId)?.sortOrder ?? 999
  if (ca !== cb) return ca - cb
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
})

export function getVoicePresetById(id: string): VoicePreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

export function listVoicePresets(): VoicePreset[] {
  return PRESETS
}

function toPublic(p: VoicePreset): VoicePresetPublic {
  return {
    id: p.id,
    label: p.label,
    tagline: p.tagline,
    placeholder: p.placeholder,
    imageSrc: p.imageSrc,
    defaultSpeakerLabel: p.defaultSpeakerLabel,
    categoryId: p.categoryId,
    status: p.status,
  }
}

/** @deprecated Prefer voicePresetsApiPayload for full client shape */
export function listVoicePresetsPublic(): VoicePresetPublic[] {
  return PRESETS.map(toPublic)
}

export function voicePresetsApiPayload(): {
  categories: VoicePresetCategory[]
  presets: VoicePresetPublic[]
} {
  return {
    categories: [...VOICE_PRESET_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder),
    presets: PRESETS.map(toPublic),
  }
}

export function resolvePresetProviderVoiceId(preset: VoicePreset): string | undefined {
  const fromEnv = preset.providerVoiceIdEnv
    ? process.env[preset.providerVoiceIdEnv]?.trim()
    : undefined
  const explicit = preset.providerVoiceId?.trim()
  return fromEnv || explicit || undefined
}

export function assertActivePresetProviderVoiceId(preset: VoicePreset): string {
  if (preset.status !== "active") {
    throw new Error("This preset is coming soon.")
  }
  const voiceId = resolvePresetProviderVoiceId(preset)
  if (!voiceId) {
    const key = preset.providerVoiceIdEnv ?? `provider voice id for ${preset.id}`
    throw new GenerationConfigError(
      `ElevenLabs preset "${preset.label}" is missing its voice ID. Set ${key} in the server environment (Vercel → Env).`
    )
  }
  return voiceId
}

/** True when every active catalog preset has a resolved ElevenLabs provider voice id. */
export function activePresetsHaveElevenLabsVoiceIds(): boolean {
  for (const p of PRESETS) {
    if (p.status !== "active") continue
    if (!resolvePresetProviderVoiceId(p)?.trim()) return false
  }
  return true
}

/** Turn preset ref path into an absolute URL for Replicate / storage. */
export function absoluteUrlForRefAudio(refAudioUrl: string, requestOrigin: string): string {
  if (refAudioUrl.startsWith("http://") || refAudioUrl.startsWith("https://")) {
    return refAudioUrl
  }
  const path = refAudioUrl.startsWith("/") ? refAudioUrl : `/${refAudioUrl}`
  return `${requestOrigin.replace(/\/$/, "")}${path}`
}
