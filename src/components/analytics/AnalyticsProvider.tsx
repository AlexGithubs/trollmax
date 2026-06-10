"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { PostHogProvider } from "posthog-js/react"
import posthog from "posthog-js"
import {
  ANALYTICS_EVENTS,
  identifyUser,
  initPostHog,
  resetAnalytics,
  track,
} from "@/lib/analytics"
import { PostHogPageView } from "@/components/analytics/PostHogPageView"
import { AnalyticsConsentBanner } from "@/components/analytics/AnalyticsConsentBanner"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser()
  const prevSignedIn = useRef<boolean | null>(null)

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    function onConsentChanged(event: Event) {
      const accepted = (event as CustomEvent<{ accepted: boolean }>).detail.accepted
      if (!accepted || !isSignedIn || !user) return
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      })
    }
    window.addEventListener("trollmax:analytics-consent", onConsentChanged)
    return () => window.removeEventListener("trollmax:analytics-consent", onConsentChanged)
  }, [isSignedIn, user])

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn && user) {
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      })
      if (prevSignedIn.current === false) {
        track(ANALYTICS_EVENTS.signIn)
      }
    } else if (prevSignedIn.current === true) {
      resetAnalytics()
    }

    prevSignedIn.current = isSignedIn
  }, [isLoaded, isSignedIn, user])

  return (
    <PostHogProvider client={posthog}>
      <PostHogPageView />
      {children}
      <AnalyticsConsentBanner />
    </PostHogProvider>
  )
}
