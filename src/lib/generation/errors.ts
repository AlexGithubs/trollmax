/** Thrown when generation cannot run due to missing server configuration (env, preset IDs). */
export class GenerationConfigError extends Error {
  readonly code = "GENERATION_CONFIG" as const

  constructor(message: string) {
    super(message)
    this.name = "GenerationConfigError"
  }
}

export function isGenerationConfigError(err: unknown): err is GenerationConfigError {
  return err instanceof GenerationConfigError
}
