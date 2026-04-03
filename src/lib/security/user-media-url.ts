/**
 * Restrict user-supplied media URLs to our storage (or dev/mock) so arbitrary
 * third-party URLs are not passed to D-ID, Replicate, etc.
 */

function isVercelBlobHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h.endsWith(".blob.vercel-storage.com")
}

export function isAllowedUserUploadedAssetUrl(
  urlStr: string,
  requestOrigin: string
): boolean {
  if (!urlStr?.trim()) return false
  // Never allow the open URL bypass in production, even if mock mode is mistakenly enabled.
  if (process.env.NEXT_PUBLIC_MOCK_MODE === "true" && process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(urlStr)
      return u.protocol === "http:" || u.protocol === "https:"
    } catch {
      return false
    }
  }

  try {
    const u = new URL(urlStr, requestOrigin)
    if (isVercelBlobHost(u.hostname)) return true

    if (process.env.NODE_ENV === "development") {
      const ro = new URL(requestOrigin)
      if (u.origin === ro.origin && u.pathname.startsWith("/api/dev-assets/")) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}
