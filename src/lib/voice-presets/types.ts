export type VoicePresetStatus = "active" | "coming_soon"

export interface VoicePreset {
  id: string
  label: string
  tagline: string
  placeholder: string
  imageSrc: string
  refAudioUrl: string
  refText: string
  defaultSpeakerLabel: string
  categoryId: string
  status: VoicePresetStatus
  /** Trained provider voice ID used for one-time-trained presets. */
  providerVoiceId?: string
  /** Optional env var name used to resolve trained provider voice ID. */
  providerVoiceIdEnv?: string
  sortOrder?: number
}

/** Client-safe preset row (no ref audio URL or transcript). */
export type VoicePresetPublic = Pick<
  VoicePreset,
  | "id"
  | "label"
  | "tagline"
  | "placeholder"
  | "imageSrc"
  | "defaultSpeakerLabel"
  | "categoryId"
  | "status"
>
