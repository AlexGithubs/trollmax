/** Dispatched when credits are ready and a pending generation should resume. */
export const PENDING_GENERATION_RESUME_EVENT = "trollmax:pending-generation-resume"

export type PendingGenerationResumeDetail = {
  product: "video" | "soundboard"
  manifestId: string
}

export function dispatchPendingGenerationResume(detail: PendingGenerationResumeDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(PENDING_GENERATION_RESUME_EVENT, { detail }))
}

type EntitlementResponse = {
  bananaCreditsBalance?: number
}

/**
 * Poll entitlement until balance covers required credits or timeout.
 * Returns the new balance on success, null on timeout/failure.
 */
export async function pollUntilCredits(
  required: number,
  maxMs = 30_000
): Promise<number | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch("/api/billing/entitlement")
      if (res.ok) {
        const data = (await res.json()) as EntitlementResponse
        const balance = data.bananaCreditsBalance
        if (typeof balance === "number" && balance >= required) {
          return balance
        }
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}
