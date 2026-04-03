import sharp from "sharp"

/** Match D-ID / headshot-upload safety margin */
const MAX_OUTPUT_BYTES = 9_000_000
const MAX_DIMENSION = 1280

/**
 * Decode common image inputs (webp, heic, gif, tiff, png, jpeg, …) and emit a JPEG
 * suitable for D-ID, recompressing until under the byte cap.
 */
export async function normalizeHeadshotToJpeg(input: Buffer): Promise<Buffer> {
  let quality = 88
  let last: Buffer | null = null

  for (let attempt = 0; attempt < 14; attempt++) {
    const out = await sharp(input, { failOn: "truncated" })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    last = out
    if (out.length <= MAX_OUTPUT_BYTES) return out
    quality -= 6
    if (quality < 38) break
  }

  // Still too large: shrink dimensions and retry.
  let dim = 1024
  for (let round = 0; round < 6 && last && last.length > MAX_OUTPUT_BYTES; round++) {
    dim = Math.max(512, Math.floor(dim * 0.85))
    const out = await sharp(input, { failOn: "truncated" })
      .rotate()
      .resize(dim, dim, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    last = out
  }

  if (!last || last.length > MAX_OUTPUT_BYTES) {
    throw new Error("Could not compress image enough. Try a smaller or lower-resolution photo.")
  }
  return last
}
