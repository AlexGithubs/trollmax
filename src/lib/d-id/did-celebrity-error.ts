/**
 * Thrown when D-ID rejects the headshot as a celebrity/public figure.
 * Video generation may retry with fal Wav2Lip (FAL_KEY) and optionally Replicate SadTalker (TROLLMAX_SADTALKER_FALLBACK);
 * users should not see this unless no backup is configured or all fallbacks fail.
 */
export class DidCelebrityBlockedError extends Error {
  readonly code = "DID_CELEBRITY_BLOCKED" as const

  constructor() {
    super("D-ID CelebrityDetectedError")
    this.name = "DidCelebrityBlockedError"
  }
}

export function isDidCelebrityBlockedError(err: unknown): err is DidCelebrityBlockedError {
  if (err instanceof DidCelebrityBlockedError) return true
  return err instanceof Error && err.name === "DidCelebrityBlockedError"
}
