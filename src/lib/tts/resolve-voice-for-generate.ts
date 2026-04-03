import type { SoundboardManifest, VideoManifest } from "@/lib/manifests/types"
import type { TTSProvider } from "@/lib/providers/types"
import { getTtsProviderForTier } from "@/lib/providers"
import { resolveManifestTtsTier } from "@/lib/tts/tiers"
import {
  assertActivePresetProviderVoiceId,
  getVoicePresetById,
} from "@/lib/voice-presets/catalog"

export type VoiceSynthesisContext = {
  provider: TTSProvider
  voiceId: string
  refText?: string
}

/**
 * Prepare soundboard: clone when needed (EL IVC), persist manifest updates.
 */
export async function resolveSoundboardVoiceForGenerate(
  manifest: SoundboardManifest,
  persist: (next: SoundboardManifest) => Promise<void>
): Promise<VoiceSynthesisContext> {
  const tier = resolveManifestTtsTier(manifest)
  const provider = getTtsProviderForTier(tier)

  if (manifest.voicePresetId) {
    const preset = getVoicePresetById(manifest.voicePresetId)
    if (!preset) throw new Error("Unknown voice preset")
    if (preset.status !== "active") throw new Error("Preset voice is not active")

    if (tier === "elevenlabs") {
      return {
        provider,
        voiceId: assertActivePresetProviderVoiceId(preset),
        refText: manifest.voiceRefText?.trim() || preset.refText?.trim() || undefined,
      }
    }

    if (tier === "replicate") {
      return {
        provider,
        voiceId: manifest.voiceSampleUrl,
        refText: manifest.voiceRefText?.trim() || preset.refText?.trim() || undefined,
      }
    }
    throw new Error(`Unsupported tier for preset soundboard generation: ${tier}`)
  }

  // Custom upload (no preset)
  if (tier === "replicate") {
    return {
      provider,
      voiceId: manifest.voiceSampleUrl,
      refText: manifest.voiceRefText?.trim(),
    }
  }

  // elevenlabs + upload: IVC once
  let vid = manifest.voiceId.trim()
  if (vid === manifest.voiceSampleUrl.trim()) {
    const cloned = await provider.clone({
      sampleAudioUrl: manifest.voiceSampleUrl,
      speakerName: manifest.speakerLabel,
    })
    vid = cloned.voiceId
    const next: SoundboardManifest = {
      ...manifest,
      voiceId: vid,
      updatedAt: new Date().toISOString(),
    }
    await persist(next)
  }
  return {
    provider,
    voiceId: vid,
    refText: manifest.voiceRefText?.trim(),
  }
}

/**
 * Video generation: single script synthesis (no clone loop — clone inline if needed).
 */
export async function resolveVideoVoiceForGenerate(
  manifest: VideoManifest,
  persist: (next: VideoManifest) => Promise<void>
): Promise<VoiceSynthesisContext> {
  const tier = resolveManifestTtsTier(manifest)
  const provider = getTtsProviderForTier(tier)

  if (manifest.voicePresetId) {
    const preset = getVoicePresetById(manifest.voicePresetId)
    if (!preset) throw new Error("Unknown voice preset")
    if (preset.status !== "active") throw new Error("Preset voice is not active")

    const sampleUrl = manifest.voiceSampleUrl?.trim()
    if (!sampleUrl) {
      throw new Error("Video manifest missing voiceSampleUrl for preset (redeploy client).")
    }

    if (tier === "elevenlabs") {
      return {
        provider,
        voiceId: assertActivePresetProviderVoiceId(preset),
        refText: manifest.voiceRefText?.trim() || preset.refText?.trim() || undefined,
      }
    }
    if (tier === "replicate") {
      return {
        provider,
        voiceId: sampleUrl,
        refText: manifest.voiceRefText?.trim() || preset.refText?.trim() || undefined,
      }
    }
    throw new Error(`Unsupported tier for preset video generation: ${tier}`)
  }

  // Upload / board voice: voiceId + voiceSampleUrl on manifest
  const sampleUrl =
    manifest.voiceSampleUrl?.trim() ||
    (manifest.voiceId.trim().startsWith("http") ? manifest.voiceId.trim() : "")
  if (!sampleUrl) {
    throw new Error("Video manifest missing voiceSampleUrl for custom voice.")
  }

  if (tier === "replicate") {
    return {
      provider,
      voiceId: sampleUrl,
      refText: manifest.voiceRefText?.trim(),
    }
  }

  let vid = manifest.voiceId.trim()
  if (vid === sampleUrl) {
    const cloned = await provider.clone({
      sampleAudioUrl: sampleUrl,
      speakerName: manifest.title.slice(0, 80) || "video",
    })
    vid = cloned.voiceId
    await persist({
      ...manifest,
      voiceId: vid,
      updatedAt: new Date().toISOString(),
    })
  }
  return {
    provider,
    voiceId: vid,
    refText: manifest.voiceRefText?.trim(),
  }
}
