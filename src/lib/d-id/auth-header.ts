/**
 * Normalize D-ID credentials from env.
 *
 * D-ID auth is **not** standard RFC 7617 Base64 — their docs specify:
 *   Authorization: Basic API_USERNAME:API_PASSWORD
 * (literal username:password after "Basic ", no encoding).
 *
 * @see https://docs.d-id.com/reference/basic-authentication
 */
export function normalizeDidCredentials(): { username: string; password: string } {
  const apiKey = process.env.DID_API_KEY?.trim()
  if (apiKey) {
    if (apiKey.includes(":")) {
      const [u, ...rest] = apiKey.split(":")
      return { username: u, password: rest.join(":") }
    }
    return { username: apiKey, password: "" }
  }

  let username = process.env.DID_API_USERNAME?.trim() ?? ""
  let password = process.env.DID_API_PASSWORD?.trim() ?? ""

  if (!password && username.includes(":")) {
    const [u, ...rest] = username.split(":")
    username = u
    password = rest.join(":")
  }

  if (!username) {
    throw new Error(
      "D-ID is not configured. Set DID_API_USERNAME + DID_API_PASSWORD (from D-ID Studio → API), or DID_API_KEY as username:password."
    )
  }

  return { username, password }
}

/** Authorization header for all D-ID API calls. */
export function buildDidAuthHeader(): string {
  const { username, password } = normalizeDidCredentials()
  return `Basic ${username}:${password}`
}
