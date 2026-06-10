"use client"

import posthog from "posthog-js"
import { readAnalyticsConsent } from "@/lib/analytics/consent"

export const ANALYTICS_EVENTS = {
  landingCtaClick: "landing_cta_click",
  formStarted: "form_started",
  signIn: "sign_in",
  generateClicked: "generate_clicked",
  generateSuccess: "generate_success",
  generateFailed: "generate_failed",
  creditGateShown: "credit_gate_shown",
  checkoutStarted: "checkout_started",
  shareClicked: "share_clicked",
  purchase: "purchase",
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export type ProductKind = "video" | "soundboard"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
/** Same-origin proxy — works in dev + prod and satisfies Clerk CSP (`connect-src 'self'`). */
const POSTHOG_API_HOST = "/ingest"

let initialized = false

function applyStoredConsent() {
  const consent = readAnalyticsConsent()
  if (consent === "accepted") {
    posthog.opt_in_capturing()
  } else if (consent === "rejected") {
    posthog.opt_out_capturing()
  }
}

/** Keep PostHog opt-in aligned with our consent banner (they can desync). */
function ensureCaptureReady(): boolean {
  if (!hasAnalyticsConsent()) return false
  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing()
  }
  return true
}

export function initPostHog() {
  if (typeof window === "undefined" || !POSTHOG_KEY) return false
  if (!initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_API_HOST,
      ui_host: POSTHOG_HOST,
      person_profiles: "always",
      opt_out_capturing_by_default: true,
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: true,
      capture_performance: true,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-mask]",
      },
    })
    initialized = true
  }
  applyStoredConsent()
  return true
}

export function setAnalyticsConsent(accepted: boolean) {
  if (!initPostHog()) return
  if (accepted) {
    posthog.opt_in_capturing()
    posthog.capture(
      "$pageview",
      { $current_url: window.location.href },
      { send_instantly: true }
    )
  } else {
    posthog.opt_out_capturing()
  }
  window.dispatchEvent(
    new CustomEvent("trollmax:analytics-consent", { detail: { accepted } })
  )
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === "accepted"
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(POSTHOG_KEY)
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!initPostHog() || !ensureCaptureReady()) return
  posthog.capture(event, properties, { send_instantly: true })
}

export function capturePageview(url: string) {
  if (!initPostHog() || !ensureCaptureReady()) return
  posthog.capture("$pageview", { $current_url: url }, { send_instantly: true })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initPostHog() || !ensureCaptureReady()) return
  posthog.identify(userId, properties)
}

export function resetAnalytics() {
  if (!POSTHOG_KEY || !initialized) return
  posthog.reset()
}
