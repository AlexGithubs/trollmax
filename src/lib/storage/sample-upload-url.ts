/**
 * Voice samples are stored under samples/{userId}/...
 * Used to verify a client-provided URL can be deleted by that user.
 */
export function userOwnsSampleUploadUrl(urlStr: string, userId: string): boolean {
  if (!urlStr || !userId) return false
  if (urlStr === "/mock-audio.mp3" || urlStr.endsWith("/mock-audio.mp3")) {
    return true
  }
  try {
    const u = new URL(urlStr, "http://localhost")
    const path = decodeURIComponent(u.pathname)
    if (path.includes(`samples/${userId}/`)) return true
    const m = path.match(/^\/api\/dev-assets\/([^/]+)$/)
    if (m) {
      const safeName = m[1]
      return safeName.startsWith(`samples-${userId}-`)
    }
    return false
  } catch {
    return false
  }
}
