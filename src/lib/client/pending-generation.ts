const STORAGE_KEY = "trollmax:pending-generation"

export type PendingGeneration = {
  product: "video" | "soundboard"
  manifestId: string
  requiredCredits: number
  returnPath: string
}

export function savePendingGeneration(pending: PendingGeneration): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // sessionStorage unavailable
  }
}

export function readPendingGeneration(): PendingGeneration | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingGeneration
    if (
      (parsed.product === "video" || parsed.product === "soundboard") &&
      typeof parsed.manifestId === "string" &&
      typeof parsed.requiredCredits === "number" &&
      typeof parsed.returnPath === "string"
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearPendingGeneration(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage unavailable
  }
}
