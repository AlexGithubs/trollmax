"use client"

import { useCallback, useEffect, useRef } from "react"
import { Shuffle, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getBackgroundLabel,
  getNextPreviewVariant,
  getPreviewSrc,
} from "@/lib/video/backgrounds"

type BackgroundPreviewOverlayProps = {
  categoryId: string
  variant: string
  onVariantChange: (variant: string) => void
  onClose: () => void
}

export function BackgroundPreviewOverlay({
  categoryId,
  variant,
  onVariantChange,
  onClose,
}: BackgroundPreviewOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewSrc = getPreviewSrc(categoryId, variant)

  const stopVideo = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    el.pause()
    el.removeAttribute("src")
    el.load()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    return () => stopVideo()
  }, [stopVideo])

  const handleClose = () => {
    stopVideo()
    onClose()
  }

  const handleShuffle = () => {
    onVariantChange(getNextPreviewVariant(categoryId, variant))
  }

  if (!previewSrc) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${getBackgroundLabel(categoryId)} background`}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{getBackgroundLabel(categoryId)}</p>
            <p className="text-[11px] text-muted-foreground">
              Split layout preview — clip {variant} of 4
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 9:16 frame — mirrors half-layout compose (head top, clip bottom) */}
        <div className="aspect-[9/16] w-full overflow-hidden bg-black">
          <div className="flex h-1/2 flex-col items-center justify-center gap-2 border-b border-white/10 bg-secondary/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/10">
              <User className="h-7 w-7 text-primary/70" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Your character
            </p>
          </div>

          <div className="relative h-1/2 bg-black">
            <video
              ref={videoRef}
              key={previewSrc}
              src={previewSrc}
              className="h-full w-full object-cover object-center"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/40 p-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleShuffle}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle clip
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
