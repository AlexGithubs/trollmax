/**
 * Thrown when D-ID rejects the headshot as a celebrity/public figure.
 * Mapped to {@link GenerationCapabilityUnavailableError} for a soft user-facing message.
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
