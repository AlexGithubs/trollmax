/**
 * User-facing currency: banana credits (golden banana icon).
 * Balances are stored under the legacy Redis key `user:*:doinks`.
 */

const BANANA_CREDIT_ICON = "/cylinder-credit.png"

/** Fixed value for APIs that expose which currency the app uses. */
export const CURRENCY_MODE = "banana_credits" as const

export function currencyIconSrc(): string {
  return BANANA_CREDIT_ICON
}

export function currencyIconAlt(): string {
  return "Banana credits"
}

export function currencyNamePluralLower(): string {
  return "banana credits"
}

export function currencyNamePluralTitle(): string {
  return "Banana credits"
}

/** e.g. "1 banana credit" / "2 banana credits" */
export function formatCurrencyCost(amount: number): string {
  return `${amount} ${amount === 1 ? "banana credit" : "banana credits"}`
}
