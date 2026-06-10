/** Sanitize a video title for use as a download filename. */
export function safeDownloadFilename(title: string): string {
  const base = title.replace(/[^\w\s.-]/g, "").trim().slice(0, 80)
  return base ? `${base}.mp4` : "video.mp4"
}
