const STORAGE_KEY = "trollmax:generating-video-id"

/** While set, the app suppresses the “video ready” popup for this id (active generation tab). */
export function setActiveGeneratingVideoId(videoId: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, videoId)
  } catch {
    // sessionStorage unavailable
  }
}

export function clearActiveGeneratingVideoId(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage unavailable
  }
}

export function readActiveGeneratingVideoId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export async function acknowledgeVideoReady(videoId: string): Promise<void> {
  try {
    await fetch(`/api/video/${videoId}/ack-view`, { method: "POST" })
  } catch {
    // non-fatal
  }
}
