/** Dispatched after generation completes with the new balance from the API. */
export const BANANA_CREDITS_UPDATED_EVENT = "trollmax:banana-credits-updated"

/** How long client-side balance updates win over stale server props (router.refresh race). */
export const BANANA_CREDITS_CLIENT_OVERRIDE_MS = 5000

export function emitBananaCreditsUpdated(balance: number) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(BANANA_CREDITS_UPDATED_EVENT, { detail: { balance } })
  )
}

type EntitlementResponse = {
  bananaCreditsBalance?: number
}

/** Fetch the authoritative balance and broadcast it to all credit widgets. */
export async function refreshBananaCreditsFromServer(): Promise<number | null> {
  if (typeof window === "undefined") return null
  try {
    const res = await fetch("/api/billing/entitlement", { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as EntitlementResponse
    if (typeof data.bananaCreditsBalance === "number") {
      emitBananaCreditsUpdated(data.bananaCreditsBalance)
      return data.bananaCreditsBalance
    }
  } catch {
    // non-fatal
  }
  return null
}
