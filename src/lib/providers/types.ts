import type { Caption } from "@/lib/manifests/types"

// ── TTS Provider ────────────────────────────────────────────────────────────

export interface CloneOptions {
  /** Vercel Blob URL of the uploaded voice sample audio */
  sampleAudioUrl: string
  /** Display label only — not used for identity claims */
  speakerName: string
}

export interface CloneResult {
  /** Opaque ID stored in the SoundboardManifest */
  voiceId: string
  previewUrl?: string
}

export interface SynthesizeOptions {
  voiceId: string
  /** Max 500 chars enforced at API layer */
  text: string
  language?: string
  /** Optional transcript of the reference audio — improves speaker similarity for F5-TTS */
  refText?: string
}

export interface SynthesizeResult {
  /** Vercel Blob URL of the generated audio */
  audioUrl: string
  durationSeconds: number
}

export interface TTSProvider {
  clone(opts: CloneOptions): Promise<CloneResult>
  synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult>
  /** Required for DMCA compliance — removes voice data from provider */
  deleteVoice(voiceId: string): Promise<void>
}

// ── Captions Provider ────────────────────────────────────────────────────────

export interface CaptionsProvider {
  transcribe(audioUrl: string): Promise<Caption[]>
}

// ── Video Composer ───────────────────────────────────────────────────────────

export interface VideoComposeOptions {
  audioUrl: string
  /** Pre-downloaded audio bytes. When provided, Modal receives audio inline (base64) and never
   * needs to fetch the blob URL — avoids 403 on private Vercel Blob stores. */
  audioBytes?: Buffer
  backgroundVideoUrl: string
  captions: Caption[]
  outputFormat: "mp4"
  /** Portrait 9:16 for short-form social */
  resolution: "1080x1920"
  /** Optional per-voice gain multiplier applied to the audio track. */
  voiceVolumeMultiplier?: number
  /** Optional D-ID rendered talking-head MP4 (video stream only). */
  talkingVideoUrl?: string
  /** Layout for combining D-ID talking head + background. */
  talkingMode?: "full" | "half"
}

export interface VideoComposeResult {
  jobId: string
  status: "queued" | "processing" | "complete" | "failed"
  videoUrl?: string
  errorMessage?: string
}

export interface VideoComposer {
  /** Starts async job — returns immediately with jobId */
  compose(opts: VideoComposeOptions): Promise<VideoComposeResult>
  getStatus(jobId: string): Promise<VideoComposeResult>
}
