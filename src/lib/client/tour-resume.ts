const STORAGE_KEY = "trollmax:tour-resume"

export type TourResumeContext = {
  returnPath: string
  savedAt: number
}

export function saveTourResumeContext(returnPath: string): void {
  if (typeof window === "undefined" || !returnPath.startsWith("/app")) return
  try {
    const ctx: TourResumeContext = { returnPath, savedAt: Date.now() }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx))
  } catch {
    // sessionStorage unavailable
  }
}

export function loadTourResumeContext(): TourResumeContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TourResumeContext
    if (typeof parsed.returnPath !== "string" || !parsed.returnPath.startsWith("/app")) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Read resume context and remove it from storage. */
export function consumeTourResumeContext(): TourResumeContext | null {
  const ctx = loadTourResumeContext()
  if (!ctx) return null
  clearTourResumeContext()
  return ctx
}

export function clearTourResumeContext(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage unavailable
  }
}
