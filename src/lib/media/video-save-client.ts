import { safeDownloadFilename } from "@/lib/media/safe-download-filename"

export type VideoSaveMode = "mp4" | "camera-roll"

export { safeDownloadFilename }

function isCoarsePointerMobile(): boolean {
  if (typeof navigator === "undefined") return false
  const uaMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const coarsePointer =
    typeof window !== "undefined" &&
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(pointer: coarse)").matches
  return uaMobile || coarsePointer
}

function canShareVideoFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
    return false
  }
  try {
    const probe = new File([new Uint8Array(0)], "probe.mp4", { type: "video/mp4" })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/** Desktop → MP4 download; phones with file share → camera roll via share sheet. */
export function getVideoSaveMode(): VideoSaveMode {
  if (!isCoarsePointerMobile()) return "mp4"
  return canShareVideoFiles() ? "camera-roll" : "mp4"
}

async function fetchVideoBlob(playUrl: string): Promise<Blob> {
  const res = await fetch(playUrl)
  if (!res.ok) throw new Error(`Video download failed (${res.status})`)
  return res.blob()
}

/** Trigger a file download without loading the full video into JS memory (desktop). */
export function triggerMp4Download(playUrl: string, filename: string): void {
  const a = document.createElement("a")
  a.href = playUrl
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Mobile fallback when `<a download>` is ignored — fetch then save via blob URL. */
export async function downloadVideoAsMp4(playUrl: string, filename: string): Promise<void> {
  const blob = await fetchVideoBlob(playUrl)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** iOS/Android share sheet — user picks Save Video / Photos to add to camera roll. */
export async function shareVideoToCameraRoll(playUrl: string, filename: string): Promise<void> {
  const blob = await fetchVideoBlob(playUrl)
  const file = new File([blob], filename, { type: blob.type || "video/mp4" })
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error("Saving to Photos is not supported in this browser")
  }
  await navigator.share({ files: [file] })
}
