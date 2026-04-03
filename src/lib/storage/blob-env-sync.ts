/**
 * `@vercel/blob` only reads `BLOB_READ_WRITE_TOKEN`. The Vercel Blob dashboard
 * has sometimes shown `BLOBS_READ_WRITE_TOKEN` (extra "S"). Copy-pasting that name
 * leaves the SDK with no token, or teams set both with a bad value in the canonical key.
 * If only the typo is set, mirror it so `put` / `get` authenticate.
 */
const canonical = process.env.BLOB_READ_WRITE_TOKEN?.trim()
const typoAlias = process.env.BLOBS_READ_WRITE_TOKEN?.trim()
if (!canonical && typoAlias) {
  process.env.BLOB_READ_WRITE_TOKEN = typoAlias
}

/**
 * Vercel Blob stores are created as either **public** or **private**; you cannot change that later.
 * - Private store + `put({ access: "private" })` → OK (recommended for user audio).
 * - Public store + `put({ access: "private" })` → SDK error: "Cannot use private access on a public store".
 * - Public store + `put({ access: "public" })` → OK (set `BLOB_UPLOAD_ACCESS=public` if you must use a public store).
 *
 * Default remains `private` so a properly configured private store works without extra env.
 */
export function getBlobPutAccess(): "public" | "private" {
  const v = process.env.BLOB_UPLOAD_ACCESS?.trim().toLowerCase()
  if (v === "public") return "public"
  return "private"
}
