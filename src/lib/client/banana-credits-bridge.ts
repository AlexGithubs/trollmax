/** Dispatched after generation completes with the new balance from the API. */
export const BANANA_CREDITS_UPDATED_EVENT = "trollmax:banana-credits-updated"

export function emitBananaCreditsUpdated(balance: number) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(BANANA_CREDITS_UPDATED_EVENT, { detail: { balance } })
  )
}
