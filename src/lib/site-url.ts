/**
 * Canonical site origin for metadata, share links, and Open Graph resolution.
 * Set `NEXT_PUBLIC_APP_URL` in production (https://trollmax.xyz, no trailing slash).
 */
export function getSiteBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/+$/, "")
}

/**
 * Always returns a valid URL so Next can resolve relative `og:image` paths at build time.
 * Production should set `NEXT_PUBLIC_APP_URL` to your real origin (e.g. https://trollmax.xyz).
 */
export function getMetadataBase(): URL {
  const base = getSiteBaseUrl()
  if (base) {
    try {
      return new URL(`${base}/`)
    } catch {
      /* fall through */
    }
  }
  return new URL("http://localhost:3000/")
}
