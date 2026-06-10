"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, ImageDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  downloadVideoAsMp4,
  getVideoSaveMode,
  safeDownloadFilename,
  shareVideoToCameraRoll,
  triggerMp4Download,
  type VideoSaveMode,
} from "@/lib/media/video-save-client"

export function VideoDownloadButton({
  videoId,
  title,
  className,
}: {
  videoId: string
  title: string
  className?: string
}) {
  const [saveMode, setSaveMode] = useState<VideoSaveMode>("mp4")
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSaveMode(getVideoSaveMode())
    setMounted(true)
  }, [])

  const playUrl = `/api/video/${videoId}/play?download=1`
  const filename = safeDownloadFilename(title)
  const isCameraRoll = saveMode === "camera-roll"

  const label = !mounted
    ? "Save video"
    : isCameraRoll
      ? "Save to Photos"
      : "Download MP4"

  const handleSave = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (isCameraRoll) {
        await shareVideoToCameraRoll(playUrl, filename)
        return
      }

      if (saveMode === "mp4" && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        triggerMp4Download(playUrl, filename)
        return
      }

      await downloadVideoAsMp4(playUrl, filename)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      try {
        if (isCameraRoll) {
          await downloadVideoAsMp4(playUrl, filename)
        } else {
          triggerMp4Download(playUrl, filename)
        }
      } catch {
        window.open(playUrl, "_blank", "noopener,noreferrer")
      }
    } finally {
      setBusy(false)
    }
  }, [busy, filename, isCameraRoll, playUrl, saveMode])

  const Icon = busy ? Loader2 : isCameraRoll ? ImageDown : Download

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={busy}
      onClick={() => void handleSave()}
      aria-busy={busy}
    >
      <Icon className={cn("h-4 w-4", busy && "animate-spin")} />
      {busy ? "Saving…" : label}
    </Button>
  )
}
