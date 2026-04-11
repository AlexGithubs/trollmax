/**
 * Normalize `replicate.run()` output for models that return a file URL (or Replicate `FileOutput`).
 *
 * The JS SDK wraps `https:` / `data:` string outputs in `FileOutput` (ReadableStream + helpers).
 * **`FileOutput.prototype.url()` returns a `URL` object**, not a string — callers must use `.href`.
 */
function tryUrlFromUrlMethod(obj: { url?: () => unknown }): string | null {
  if (typeof obj.url !== "function") return null
  try {
    const u = obj.url()
    if (typeof u === "string" && u.startsWith("http")) return u
    if (u instanceof URL && u.href.startsWith("http")) return u.href
  } catch {
    return null
  }
  return null
}

/** Replicate `FileOutput` overrides `toString()` to return the delivery URL string. */
function tryUrlFromToString(obj: object): string | null {
  const toString = (obj as { toString?: () => unknown }).toString
  if (typeof toString !== "function") return null
  const s = toString.call(obj)
  if (typeof s === "string" && s.startsWith("http") && !s.startsWith("[object ")) return s
  return null
}

function firstHttpUrlDeep(value: unknown, depth: number): string | null {
  if (depth > 12) return null
  if (typeof value === "string" && value.startsWith("http")) return value
  if (!value || typeof value !== "object") return null

  const fromMethod = tryUrlFromUrlMethod(value as { url?: () => unknown })
  if (fromMethod) return fromMethod

  if (Array.isArray(value)) {
    for (const el of value) {
      const found = firstHttpUrlDeep(el, depth + 1)
      if (found) return found
    }
    return null
  }

  if (Object.prototype.toString.call(value) === "[object Object]") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = firstHttpUrlDeep(v, depth + 1)
      if (found) return found
    }
  }

  return null
}

function describeOutput(output: unknown): string {
  if (output === null) return "null"
  if (Array.isArray(output)) return `array(length=${output.length})`
  if (typeof output === "object") {
    const keys = Object.keys(output as object)
    return `object(${keys.slice(0, 8).join(",")}${keys.length > 8 ? ",…" : ""})`
  }
  return typeof output
}

/**
 * Returns an HTTPS (or HTTP) URL string for downstream `fetch`, or throws with a useful message.
 */
export function resolveReplicateOutputMediaUrl(output: unknown, context: string): string {
  if (typeof output === "string" && output.startsWith("http")) {
    return output
  }

  if (output && typeof output === "object") {
    const fromUrl = tryUrlFromUrlMethod(output as { url?: () => unknown })
    if (fromUrl) return fromUrl

    const fromStr = tryUrlFromToString(output)
    if (fromStr) return fromStr
  }

  if (Array.isArray(output) && output.length > 0) {
    const fromEl = firstHttpUrlDeep(output[0], 0)
    if (fromEl) return fromEl
  }

  const nested = firstHttpUrlDeep(output, 0)
  if (nested) return nested

  throw new Error(`${context}: could not resolve media URL from Replicate output (${describeOutput(output)})`)
}
