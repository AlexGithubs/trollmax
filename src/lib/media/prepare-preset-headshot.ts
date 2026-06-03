import sharp from "sharp"

/** Output size tuned for D-ID talking-head (portrait, face-forward). */
const OUT_WIDTH = 1024
const OUT_HEIGHT = 1280

/**
 * Crop preset headshots for D-ID: center-weighted portrait crop (never saliency/attention —
 * it drifts toward colorful backgrounds and decenter faces).
 */
export async function preparePresetHeadshotForDid(input: Buffer): Promise<Buffer> {
  const rotated = sharp(input, { failOn: "truncated" }).rotate()
  const meta = await rotated.metadata()
  const w = meta.width ?? OUT_WIDTH
  const h = meta.height ?? OUT_HEIGHT

  // Keep the middle ~88% of the frame; bias slightly upward so chest-up portraits
  // retain the full head without chopping hair.
  const keep = 0.88
  const cropW = Math.max(1, Math.round(w * keep))
  const cropH = Math.max(1, Math.round(h * keep))
  const left = Math.max(0, Math.round((w - cropW) / 2))
  const top = Math.max(0, Math.round((h - cropH) * 0.34))

  return sharp(input, { failOn: "truncated" })
    .rotate()
    .extract({
      left: Math.min(left, w - cropW),
      top: Math.min(top, h - cropH),
      width: Math.min(cropW, w - left),
      height: Math.min(cropH, h - top),
    })
    .resize(OUT_WIDTH, OUT_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
}
