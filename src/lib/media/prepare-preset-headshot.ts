import sharp from "sharp"

/** Max long edge sent to D-ID — preserves scene context; D-ID does its own face tracking. */
const MAX_LONG_EDGE = 1280

/**
 * Light headshot prep for D-ID: rotate + resize down if huge. No face crop — cropping before
 * D-ID causes double-zoom (tight input → D-ID face lock → tight output).
 */
export async function prepareHeadshotForDid(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "truncated" })
    .rotate()
    .resize(MAX_LONG_EDGE, MAX_LONG_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

/** @deprecated Use {@link prepareHeadshotForDid}. Kept for script import name stability. */
export const preparePresetHeadshotForDid = prepareHeadshotForDid
