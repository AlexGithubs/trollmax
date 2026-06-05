/**
 * Thrown when HeyGen rejects the headshot because it detected a celebrity or
 * public figure (error codes CELEBRITY_CONTENT / CELEBRITY_MODERATION_FAILED).
 *
 * Maps to GenerationCapabilityUnavailableError in the generate route,
 * matching the same soft user-facing message used for D-ID celebrity blocks.
 *
 * No credits are charged for rejected jobs (HeyGen confirmed).
 */
export class HeygenCelebrityBlockedError extends Error {
  readonly code = "HEYGEN_CELEBRITY_BLOCKED" as const

  constructor() {
    super("HeyGen celebrity/public-figure detected")
    this.name = "HeygenCelebrityBlockedError"
  }
}

export function isHeygenCelebrityBlockedError(
  err: unknown
): err is HeygenCelebrityBlockedError {
  if (err instanceof HeygenCelebrityBlockedError) return true
  return err instanceof Error && err.name === "HeygenCelebrityBlockedError"
}

/** HeyGen error codes that indicate a celebrity/public-figure content block. */
const HEYGEN_CELEBRITY_CODES = new Set([
  "CELEBRITY_CONTENT",        // 400625 — celebrity face detected at creation time
  "CELEBRITY_MODERATION_FAILED", // 402008 — moderation failed: celebrity detected
])

export function isHeygenCelebrityCode(code: string | null | undefined): boolean {
  return typeof code === "string" && HEYGEN_CELEBRITY_CODES.has(code)
}
