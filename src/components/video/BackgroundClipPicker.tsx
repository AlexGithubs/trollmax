"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { BACKGROUND_CATALOG } from "@/lib/video/backgrounds"
import { BackgroundPreviewOverlay } from "./BackgroundPreviewOverlay"

type BackgroundClipPickerProps = {
  value: string
  onChange: (id: string) => void
}

export function BackgroundClipPicker({ value, onChange }: BackgroundClipPickerProps) {
  const [previewCategory, setPreviewCategory] = useState<string | null>(null)
  const [previewVariant, setPreviewVariant] = useState("1")

  const openPreview = (categoryId: string) => {
    setPreviewVariant("1")
    setPreviewCategory(categoryId)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BACKGROUND_CATALOG.map((bg) => (
          <div
            key={bg.id}
            role="button"
            tabIndex={0}
            onClick={() => onChange(bg.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onChange(bg.id)
              }
            }}
            className={[
              "relative cursor-pointer rounded-xl border-2 p-3 text-left transition-colors sm:p-4",
              value === bg.id
                ? "border-primary bg-primary/5"
                : "border-border/40 hover:border-border/80",
            ].join(" ")}
          >
            <img
              src={bg.thumbSrc}
              alt=""
              className="mb-2 h-14 w-full rounded-lg border border-border/40 object-cover object-center"
            />
            <p className="text-sm font-medium">{bg.label}</p>
            <p className="text-xs text-muted-foreground">{bg.description}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openPreview(bg.id)
              }}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/50 bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
              aria-label={`Preview ${bg.label} background`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        ))}
      </div>

      {previewCategory && (
        <BackgroundPreviewOverlay
          categoryId={previewCategory}
          variant={previewVariant}
          onVariantChange={setPreviewVariant}
          onClose={() => setPreviewCategory(null)}
        />
      )}
    </>
  )
}
