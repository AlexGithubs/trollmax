/**
 * SadTalker inputs from env — tune fallback quality without code changes.
 * @see https://replicate.com/cjwbw/sadtalker/api
 */

const PREPROCESS = new Set(["crop", "resize", "full"])
const FACERENDER = new Set(["facevid2vid", "pirender"])

function envRaw(key: string): string | undefined {
  const v = process.env[key]?.trim()
  return v === "" ? undefined : v
}

function envLower(key: string): string | undefined {
  return envRaw(key)?.toLowerCase()
}

function parseBool(key: string, defaultTrue: boolean): boolean {
  const v = envLower(key)
  if (v === undefined) return defaultTrue
  if (v === "false" || v === "0" || v === "no") return false
  if (v === "true" || v === "1" || v === "yes") return true
  return defaultTrue
}

function parseExpressionScale(): number {
  const raw = envRaw("REPLICATE_SADTALKER_EXPRESSION_SCALE")
  if (!raw) return 1
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.min(2, Math.max(0.5, n))
}

function parseSizeOfImage(): 256 | 512 {
  const v = envRaw("REPLICATE_SADTALKER_SIZE_OF_IMAGE")
  if (v === "512") return 512
  return 256
}

function parsePoseStyle(): number | undefined {
  const raw = envRaw("REPLICATE_SADTALKER_POSE_STYLE")
  if (!raw) return undefined
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 45) return undefined
  return n
}

/**
 * Static SadTalker model inputs (excluding `source_image` and `driven_audio`).
 * Defaults match the previous hard-coded behavior.
 */
export function sadTalkerStaticInputFromEnv(): Record<string, string | number | boolean> {
  const preprocessRaw = envLower("REPLICATE_SADTALKER_PREPROCESS")
  const preprocess =
    preprocessRaw && PREPROCESS.has(preprocessRaw) ? preprocessRaw : "crop"

  const facerenderRaw = envLower("REPLICATE_SADTALKER_FACERENDER")
  const facerender =
    facerenderRaw && FACERENDER.has(facerenderRaw) ? facerenderRaw : "facevid2vid"

  const out: Record<string, string | number | boolean> = {
    still_mode: parseBool("REPLICATE_SADTALKER_STILL_MODE", true),
    use_enhancer: parseBool("REPLICATE_SADTALKER_USE_ENHANCER", true),
    use_eyeblink: parseBool("REPLICATE_SADTALKER_USE_EYEBLINK", true),
    preprocess,
    facerender,
    expression_scale: parseExpressionScale(),
    size_of_image: parseSizeOfImage(),
  }

  const pose = parsePoseStyle()
  if (pose !== undefined) {
    out.pose_style = pose
  }

  return out
}

/**
 * Conservative inputs that avoid common OpenCV ROI crashes inside SadTalker (bad face bounds with
 * `preprocess=full`, high `size_of_image`, or `pirender`). Used as automatic retry.
 */
export function sadTalkerOpenCvSafeStaticInput(): Record<string, string | number | boolean> {
  return {
    still_mode: true,
    use_enhancer: true,
    use_eyeblink: true,
    preprocess: "crop",
    facerender: "facevid2vid",
    expression_scale: 1,
    size_of_image: 256,
  }
}

/** Second-line retry when `crop` still hits ROI errors (unusual aspect ratios, edge faces). */
export function sadTalkerResizeFallbackStaticInput(): Record<string, string | number | boolean> {
  return {
    ...sadTalkerOpenCvSafeStaticInput(),
    preprocess: "resize",
  }
}

export function isSadTalkerOpenCvROIError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /OpenCV/i.test(msg) ||
    /roi\.x/.test(msg) ||
    /\(-215:Assertion failed\)/.test(msg) ||
    /function 'Mat'/.test(msg)
  )
}

function stableStringify(input: Record<string, string | number | boolean>): string {
  const keys = Object.keys(input).sort()
  return JSON.stringify(
    keys.reduce<Record<string, string | number | boolean>>((acc, k) => {
      acc[k] = input[k]!
      return acc
    }, {})
  )
}

/** True when env-based static input matches the OpenCV-safe preset (retry would be redundant). */
export function sadTalkerEnvInputIsOpenCvSafePreset(): boolean {
  return stableStringify(sadTalkerStaticInputFromEnv()) === stableStringify(sadTalkerOpenCvSafeStaticInput())
}
