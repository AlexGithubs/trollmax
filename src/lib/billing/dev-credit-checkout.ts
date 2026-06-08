import { creditBananaCredits } from "./banana-credits"
import { validateCheckoutSelection, type CreditPackId } from "./credit-packs"

/**
 * Localhost-only instant credit purchase — skips Stripe. Never enabled on production hosts.
 */
export function canUseDevCreditCheckout(req: Request): boolean {
  if (process.env.VERCEL_ENV === "production") return false
  const host = new URL(req.url).hostname
  return host === "localhost" || host === "127.0.0.1"
}

export function localRequestOrigin(req: Request): string {
  return new URL(req.url).origin
}

export async function grantDevCreditPack(
  userId: string,
  packId: CreditPackId
): Promise<{ totalCredits: number; balance: number }> {
  const sel = validateCheckoutSelection(packId)
  if (!sel.ok) {
    throw new Error(sel.error)
  }
  const balance = await creditBananaCredits(userId, sel.totalCredits)
  return { totalCredits: sel.totalCredits, balance }
}
