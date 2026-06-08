"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { HelpCircle, Map, Sparkles } from "lucide-react"
import {
  canOfferPageTour,
  pageTourStepCount,
  type TourMode,
} from "@/components/onboarding/tour-steps"
import { launchTour } from "@/lib/client/tour-launch"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  iconOnly?: boolean
}

export function TourGuideButton({ className = "", iconOnly = false }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const pathOnly = pathname ?? "/app"
  const showPageTour = canOfferPageTour(pathOnly)
  const pageSteps = pageTourStepCount(pathOnly)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function currentReturnPath() {
    return typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : pathOnly
  }

  function start(mode: TourMode) {
    setOpen(false)
    launchTour(mode, currentReturnPath())
  }

  if (!showPageTour) {
    return (
      <button
        type="button"
        onClick={() => start("full")}
        title="Full app tour"
        aria-label="Full app tour"
        className={buttonClass(iconOnly, className)}
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        {!iconOnly && <span>Tour guide</span>}
      </button>
    )
  }

  return (
    <div ref={rootRef} className={cn("relative", iconOnly ? "shrink-0" : "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choose a tour"
        aria-label="Tour guide"
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClass(iconOnly, className)}
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        {!iconOnly && <span>Tour guide</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-[220px] rounded-xl border border-border/60 bg-card p-1.5 shadow-xl",
            iconOnly ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2 w-full"
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => start("contextual")}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block text-xs font-semibold">This page</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                Quick walkthrough · {pageSteps} steps
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => start("full")}
            className="mt-0.5 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary"
          >
            <Map className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-xs font-semibold">Full app tour</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                Credits, video, soundboard · 22 steps
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function buttonClass(iconOnly: boolean, className: string) {
  return iconOnly
    ? `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`
    : `flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`
}

/** @deprecated Use TourGuideButton */
export const TourRestartButton = TourGuideButton
