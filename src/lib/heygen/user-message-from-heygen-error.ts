/** User-facing copy for thrown HeyGen pipeline errors (timeouts, poll failures, API errors, etc.). */
export function userMessageFromHeygenFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes("timed out")) {
    return "Rendering is taking longer than usual. Try again in a minute — if it keeps failing, try a different photo or character."
  }
  // Common content rejection: no usable face detected in the photo.
  if (
    lower.includes("face") ||
    lower.includes("no person") ||
    lower.includes("portrait") ||
    lower.includes("detect")
  ) {
    return "We couldn't find a clear, front-facing face in that photo. Try a sharper headshot (one person, facing the camera) or pick a preset character."
  }
  // Surface short HeyGen-prefixed messages as-is (e.g. "HeyGen create video failed: 401 …")
  if (msg.startsWith("HeyGen ") && msg.length <= 220) return msg
  return "Talking-head generation failed. Please try again in a few minutes or use a different photo."
}
