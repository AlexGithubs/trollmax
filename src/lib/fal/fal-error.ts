import { ApiError, ValidationError } from "@fal-ai/client"

/** User-facing / log message from a fal client error. */
export function messageFromFalError(err: unknown): string {
  if (err instanceof ValidationError) {
    const fe = err.fieldErrors
    if (fe?.length) {
      return `fal: ${fe.map((e) => `${e.loc.join(".")}: ${e.msg}`).join("; ")}`
    }
  }
  if (err instanceof ApiError) {
    const body = err.body as { message?: string; detail?: unknown } | undefined
    if (typeof body?.message === "string" && body.message.trim()) return body.message.trim()
    if (err.requestId) return `${err.message} (request ${err.requestId})`
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
