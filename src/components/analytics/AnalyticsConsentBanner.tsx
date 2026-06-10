"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  hasAnalyticsConsent,
  isAnalyticsConfigured,
  setAnalyticsConsent,
} from "@/lib/analytics"
import {
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics/consent"

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isAnalyticsConfigured()) return
    const stored = readAnalyticsConsent()
    setVisible(stored === null)
  }, [])

  function choose(consent: AnalyticsConsent) {
    writeAnalyticsConsent(consent)
    setAnalyticsConsent(consent === "accepted")
    setVisible(false)
  }

  if (!visible || hasAnalyticsConsent()) return null

  return (
    <div
      role="dialog"
      aria-labelledby="analytics-consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border/60 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p id="analytics-consent-title" className="text-sm font-medium text-foreground">
            Analytics & cookies
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            We use PostHog to understand how people use TROLLMAX — page views, product
            funnels, performance, and optional session replays. See our{" "}
            <Link href="/privacy#analytics" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={() => choose("rejected")}>
            Decline
          </Button>
          <Button type="button" size="sm" onClick={() => choose("accepted")}>
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  )
}
