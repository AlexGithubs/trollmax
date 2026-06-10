"use client"

import { useEffect, useRef } from "react"
import { ANALYTICS_EVENTS, track, type ProductKind } from "@/lib/analytics"

export function useTrackFormStarted(product: ProductKind) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    track(ANALYTICS_EVENTS.formStarted, { product })
  }, [product])
}
