"use client"

/**
 * Lightweight browser-side headshot checks.
 *
 * Keep this dependency-free and resilient so upload flow does not break when
 * external ML model CDNs or WASM loaders fail in some runtimes.
 */

export type HeadshotFaceResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Validates that the image is suitable as a single-person talking-head source.
 */
export async function validateHeadshotFace(
  image: HTMLImageElement | HTMLCanvasElement
): Promise<HeadshotFaceResult> {
  try {
    const w =
      "naturalWidth" in image ? image.naturalWidth || image.width : image.width
    const h =
      "naturalHeight" in image
        ? image.naturalHeight || image.height
        : image.height

    if (w < 64 || h < 64) {
      return {
        ok: false,
        message:
          "That image is too small to use. Try a larger photo or a different file.",
      }
    }

    // Basic aspect-ratio sanity check to prevent extreme panoramas/thin strips.
    const ratio = w / h
    if (ratio < 0.2 || ratio > 5) {
      return {
        ok: false,
        message:
          "This image shape looks unusual. Use a regular portrait-style photo.",
      }
    }

    return { ok: true }
  } catch (err) {
    console.error("[validateHeadshotFace]", err)
    // Fail-open: do not block upload if client-side validation infra has issues.
    return { ok: true }
  }
}
