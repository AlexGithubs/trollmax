export const ANALYTICS_CONSENT_KEY = "trollmax_analytics_consent"

export type AnalyticsConsent = "accepted" | "rejected"

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY)
  return value === "accepted" || value === "rejected" ? value : null
}

export function writeAnalyticsConsent(consent: AnalyticsConsent) {
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent)
}

export function clearAnalyticsConsent() {
  window.localStorage.removeItem(ANALYTICS_CONSENT_KEY)
}
