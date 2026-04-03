"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Zap, X } from "lucide-react"
import { STORAGE_KEY, saveState } from "./OnboardingTour"

interface Props {
  /** The pathname this banner lives on — used to find the right starting step */
  page: string
}

export function TourOfferBanner({ page }: Props) {
  const { isSignedIn, isLoaded } = useUser()
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine visibility once auth is loaded
  useEffect(() => {
    if (!mounted || !isLoaded) return

    // Only show to guests who have never interacted with the tour
    if (isSignedIn) return
    if (localStorage.getItem(STORAGE_KEY) !== null) return

    setShow(true)
  }, [mounted, isLoaded, isSignedIn])

  function handleStartTour() {
    // Always start from the welcome step (step 0) regardless of current page
    const state = { active: true, step: 0 }
    saveState(state)
    window.dispatchEvent(new CustomEvent("trollmax:start-tour", { detail: state }))
    setShow(false)
  }

  function handleDismiss() {
    saveState({ active: false, step: 0 })
    setShow(false)
  }

  if (!mounted || !show) return null

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/8 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Zap className="h-4 w-4 fill-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">New to TROLLMAX?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Take a 2-minute walkthrough to see everything this tool can do.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleStartTour}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Show me around
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border/60 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              I&apos;ll figure it out
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
