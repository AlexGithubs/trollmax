/** User-facing copy for thrown HeyGen pipeline errors (timeouts, poll failures, API errors, etc.). */
export function userMessageFromHeygenFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes("timed out")) {
    return "HeyGen is taking longer than usual. Try again in a minute — if it keeps failing, try a different character."
  }
  // Surface short HeyGen-prefixed messages as-is (e.g. "HeyGen create video failed: 401 …")
  if (msg.startsWith("HeyGen ") && msg.length <= 220) return msg
  return "Talking-head generation failed. Please try again in a few minutes or use a different photo."
}
