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

/** TTS backend: Replicate F5 (good), ElevenLabs (great / presets). */
export type TtsTier = "replicate" | "elevenlabs"

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
  /** Which TTS stack to use (default inferred from legacy manifests). */
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
}

export interface VideoManifest extends BaseManifest {
  type: "video"
  title: string
  script: string
  voiceId: string
  /** Preset reference audio URL (set at create when using voicePresetId) for F5. */
  voiceSampleUrl?: string
  /** Which TTS stack to use (default inferred from legacy manifests). */
  ttsTier?: TtsTier
  /** Transcript of reference audio when using F5-TTS zero-shot (improves quality) */
  voiceRefText?: string
  /** Set when video uses a server preset voice */
  voicePresetId?: string
  /** Set when video voice is sourced from an existing soundboard */
  soundboardId?: string
  audioUrl: string
  backgroundVideoId: string
  /** Publicly reachable photo URL used as the D-ID source image.
   * Cleared (set to "") after D-ID generation so the blob can be deleted. */
  headshotImageUrl: string
  /** Layout for combining D-ID talking head + background video */
  talkingMode: "full" | "half"
  /** Whether to burn captions into the rendered video (default true). */
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
  /** Extra detail (e.g. \"polling D-ID…\"). */
  progressDetail?: string
  /** Last error string for UI display. */
  lastError?: string
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
