function parseDidJson(bodyText: string): Record<string, unknown> | null {
  const t = bodyText.trim()
  if (!t) return null
  try {
    const parsed = JSON.parse(t) as unknown
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    // D-ID sometimes returns JSON as a string field inside another payload — try outer parse only here.
  }
  return null
}

/** True when D-ID error payload indicates celebrity/public-figure block. */
export function isDidCelebrityDetectedBody(bodyText: string): boolean {
  const o = parseDidJson(bodyText)
  if (o?.kind === "CelebrityDetectedError") return true
  const errMsg = o?.error_message ?? o?.message
  if (typeof errMsg === "string") {
    if (errMsg.includes("CelebrityDetected")) return true
    const nested = parseDidJson(errMsg)
    if (nested?.kind === "CelebrityDetectedError") return true
  }
  return false
}

/**
 * Map D-ID API error JSON to a short message we can show users (and store on failed manifests).
 * Does not apply to CelebrityDetectedError (handled via {@link isDidCelebrityDetectedBody} + capability-unavailable UX).
 */
export function userMessageFromDidErrorBody(status: number, bodyText: string): string | null {
  if (status === 401) {
    return "D-ID rejected the API credentials. Check DID_API_USERNAME and DID_API_PASSWORD in your environment."
  }
  const o = parseDidJson(bodyText)
  if (!o) return null
  if (o.kind === "CelebrityDetectedError") return null
  const description = o.description
  if (typeof description === "string" && description.trim() && status >= 400) {
    return `D-ID rejected the image: ${description.trim()}`
  }
  return null
}

/** User-facing copy for thrown D-ID pipeline errors (timeouts, poll failures, etc.). */
export function userMessageFromDidFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("timed out")) {
    return "D-ID is taking longer than usual. Try again in a minute — if it keeps failing, try a different character."
  }
  if (msg.includes("D-ID rejected the image:")) return msg
  if (msg.startsWith("D-ID ") && msg.length <= 220) return msg
  return "Talking-head generation failed. Please try again in a few minutes or use a different photo."
}
