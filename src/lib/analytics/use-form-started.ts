"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  ANALYTICS_EVENTS,
  hasAnalyticsConsent,
  track,
  type ProductKind,
} from "@/lib/analytics"

export function useTrackFormStarted(product: ProductKind) {
  const tracked = useRef(false)

  const tryTrack = useCallback(() => {
    if (tracked.current || !hasAnalyticsConsent()) return
    tracked.current = true
    track(ANALYTICS_EVENTS.formStarted, { product })
  }, [product])

  useEffect(() => {
    tryTrack()
  }, [tryTrack])

  useEffect(() => {
    function onConsentChanged(event: Event) {
      const accepted = (event as CustomEvent<{ accepted: boolean }>).detail.accepted
      if (accepted) tryTrack()
    }
    window.addEventListener("trollmax:analytics-consent", onConsentChanged)
    return () => window.removeEventListener("trollmax:analytics-consent", onConsentChanged)
  }, [tryTrack])
}
