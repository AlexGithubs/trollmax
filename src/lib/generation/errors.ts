/** Thrown when generation cannot run due to missing server configuration (env, preset IDs). */
export class GenerationConfigError extends Error {
  readonly code = "GENERATION_CONFIG" as const

  constructor(message: string) {
    super(message)
    this.name = "GenerationConfigError"
  }
}

/**
 * Next.js can duplicate class identity across bundles, breaking `instanceof`.
 * Treat by name + code so config errors still map to 503 + clear messages.
 */
export function isGenerationConfigError(err: unknown): err is GenerationConfigError {
  if (err instanceof GenerationConfigError) return true
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: unknown }).code === "GENERATION_CONFIG"
  }
  return err instanceof Error && err.name === "GenerationConfigError"
}

export const GENERATION_CAPABILITY_UNAVAILABLE_MESSAGE =
  "We haven't added celebrity face animation yet. Pick a character preset or upload your own photo."

/** Feature not available yet (e.g. D-ID celebrity block) — soft UX, not a hard error. */
export class GenerationCapabilityUnavailableError extends Error {
  readonly code = "GENERATION_CAPABILITY_UNAVAILABLE" as const

  constructor(message = GENERATION_CAPABILITY_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = "GenerationCapabilityUnavailableError"
  }
}

export function isGenerationCapabilityUnavailableError(
  err: unknown
): err is GenerationCapabilityUnavailableError {
  if (err instanceof GenerationCapabilityUnavailableError) return true
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: unknown }).code === "GENERATION_CAPABILITY_UNAVAILABLE"
  }
  return err instanceof Error && err.name === "GenerationCapabilityUnavailableError"
}

/** User-fixable input (e.g. headshot rejected by D-ID). */
export class GenerationUserInputError extends Error {
  readonly code = "GENERATION_USER_INPUT" as const

  constructor(message: string) {
    super(message)
    this.name = "GenerationUserInputError"
  }
}

export function isGenerationUserInputError(err: unknown): err is GenerationUserInputError {
  if (err instanceof GenerationUserInputError) return true
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: unknown }).code === "GENERATION_USER_INPUT"
  }
  return err instanceof Error && err.name === "GenerationUserInputError"
}
