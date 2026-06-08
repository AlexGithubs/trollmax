import type { CreditPackId } from "./credit-packs"

export const DEFAULT_CREDIT_CHECKOUT_SUCCESS_PATH = "/app"

export function validateCreditCheckoutSuccessPath(path: string | undefined): string {
  const p = (path?.trim() || DEFAULT_CREDIT_CHECKOUT_SUCCESS_PATH).split("?")[0]
  if (!p.startsWith("/")) return DEFAULT_CREDIT_CHECKOUT_SUCCESS_PATH
  if (p.startsWith("/app") || p.startsWith("/pricing")) return p
  return DEFAULT_CREDIT_CHECKOUT_SUCCESS_PATH
}

export function buildCreditPurchaseSuccessUrl(
  origin: string,
  successPath: string,
  packId: CreditPackId,
  totalCredits: number
): string {
  const qs = new URLSearchParams({
    credit_purchase: "success",
    pack: packId,
    credits_added: String(totalCredits),
  })
  return `${origin.replace(/\/$/, "")}${successPath}?${qs.toString()}`
}
