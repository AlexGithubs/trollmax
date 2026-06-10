export interface Caption {
  startMs: number
  endMs: number
  text: string
}

export interface SoundClip {
  id: string
  label: string
  text: string
  audioUrl: string
  sourceUrl?: string
  durationSeconds: number
  createdAt: string
}

/** TTS backend — ElevenLabs presets and instant voice clone. */
export type TtsTier = "elevenlabs"

export interface BaseManifest {
  id: string
  createdAt: string
  updatedAt: string
  ownerId: string
  isPublic: boolean
  consentAcknowledged: boolean
}

export interface SoundboardManifest extends BaseManifest {
  type: "soundboard"
  title: string
  voiceId: string
  voiceSampleUrl: string
  speakerLabel: string
  /** Always ElevenLabs; field kept for manifest compatibility. */
  ttsTier?: TtsTier
  /** Set when the board was created from a server preset */
  voicePresetId?: string
  /** Optional transcript of what was said in the reference audio clip */
  voiceRefText?: string
  /** Ordered list of phrases to synthesize */
  phrases: string[]
  clips: SoundClip[]
  accentColor?: string

  /** Optional generation status for UI polling (soundboards generate async-like). */
  status?: "draft" | "processing" | "complete" | "failed"
  /** Human-readable progress step (e.g. \"Cloning voice…\"). */
  progressStep?: string
  /** 0–100 */
  progressPct?: number
  /** Extra detail (e.g. \"clip 3/6\"). */
  progressDetail?: string
  /** Last error string for UI display. */
  lastError?: string
  /** Machine-readable failure code for UI styling (e.g. GENERATION_CAPABILITY_UNAVAILABLE). */
  lastErrorCode?: string
}

export interface VideoManifest extends BaseManifest {
  type: "video"
  title: string
  script: string
  voiceId: string
  /** Preset reference audio URL (set at create when using voicePresetId). */
  voiceSampleUrl?: string
  /** Always ElevenLabs; field kept for manifest compatibility. */
  ttsTier?: TtsTier
  /** Optional transcript of reference audio (improves ElevenLabs cloning/TTS quality). */
  voiceRefText?: string
  /** Set when video uses a server preset voice */
  voicePresetId?: string
  /** Set when video voice is sourced from an existing soundboard */
  soundboardId?: string
  audioUrl: string
  backgroundVideoId: string
  /** Stored headshot URL (Vercel Blob). Uploaded to talking-head provider, then deleted after use. */
  headshotImageUrl: string
  /** Character preset id when the headshot came from the catalog (draft resume). */
  headshotPresetId?: string | null
  /** Wizard step when status is draft (in-progress editor). */
  wizardStep?: 1 | 2 | 3
  /** Layout for combining talking head + background video (full or split). */
  talkingMode: "full" | "half"
  /** Whether to burn captions into the rendered video (default false). */
  captionsEnabled?: boolean
  captions: Caption[]
  jobId?: string
  status: "draft" | "processing" | "complete" | "failed"
  videoUrl?: string
  thumbnailUrl?: string

  /** Human-readable progress step (e.g. \"Creating talking head…\"). */
  progressStep?: string
  /** 0–100 */
  progressPct?: number
  /** Extra detail (e.g. \"polling HeyGen…\"). */
  progressDetail?: string
  /** Last error string for UI display. */
  lastError?: string
  /** Machine-readable failure code for UI styling (e.g. GENERATION_CAPABILITY_UNAVAILABLE). */
  lastErrorCode?: string
  /** Set when generation completes while the user may be away — cleared after they view or dismiss. */
  unseenCompletion?: boolean
}

export interface TakedownRequest {
  id: string
  createdAt: string
  reporterName: string
  reporterEmail: string
  targetUrl: string
  reason: string
  ownershipStatement: string
  goodFaithStatement: boolean
  status: "pending" | "reviewed" | "actioned"
}

export type AnyManifest = VideoManifest | SoundboardManifest

/**
 * Vercel KV key schema:
 * soundboard:{id}            → SoundboardManifest JSON
 * video:{id}                 → VideoManifest JSON
 * user:{clerkId}:soundboards → string[] (set of IDs)
 * user:{clerkId}:videos      → string[] (set of IDs)
 * user:{clerkId}:subscription→ SubscriptionRecord JSON
 * takedown:{id}              → TakedownRequest JSON
 */

export interface SubscriptionRecord {
  plan: "free" | "pro"
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  /** Stripe subscription status, e.g. active, canceled, past_due */
  subscriptionStatus?: string
  currentPeriodEnd?: string
  /** Recurring interval of the subscribed price */
  priceInterval?: "month" | "year"
}
