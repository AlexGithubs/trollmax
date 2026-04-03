import Stripe from "stripe"

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" })
  : null

/** Monthly Pro subscription price ID (Stripe Dashboard) */
export function getProPriceIdMonthly(): string | null {
  return (
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY?.trim() ||
    process.env.STRIPE_PRO_PRICE_ID?.trim() ||
    null
  )
}

/** Yearly Pro subscription price ID — set ~10–20% below 12× monthly in Dashboard */
export function getProPriceIdYearly(): string | null {
  return process.env.STRIPE_PRO_PRICE_ID_YEARLY?.trim() || null
}

export function getProPriceId(interval: "month" | "year"): string | null {
  return interval === "year" ? getProPriceIdYearly() : getProPriceIdMonthly()
}

/** Reserved for pay-per-export (not wired yet) */
export const getVideoExportPriceId = (): string | null =>
  process.env.STRIPE_VIDEO_EXPORT_PRICE_ID?.trim() || null

/** Banana credit packs (3 tiers): see `src/lib/billing/credit-packs.ts` and `.env.example`. */

/** Marketing copy on /pricing — align with your Stripe amounts */
export const PRO_DISPLAY = {
  monthlyUsd: 12,
  /** Billed once per year; ~17% off vs 12× monthly */
  yearlyUsd: 120,
} as const

export const yearlySavingsPercent = Math.round(
  (1 - PRO_DISPLAY.yearlyUsd / (PRO_DISPLAY.monthlyUsd * 12)) * 100
)

export const yearlyEffectiveMonthlyUsd = Math.round((PRO_DISPLAY.yearlyUsd / 12) * 100) / 100

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "Up to 3 soundboards (see usage on dashboard)",
      "6 phrases per board, 70 characters each",
      "5 preset voices: Demarcus, Ziyu, Luis, Farmer, Crying",
      "Custom voice upload",
      "Public share links",
    ],
    priceId: null,
  },
  pro: {
    name: "Pro",
    monthlyUsd: PRO_DISPLAY.monthlyUsd,
    yearlyUsd: PRO_DISPLAY.yearlyUsd,
    yearlySavingsPercent,
    yearlyEffectiveMonthlyUsd,
    features: [
      "Up to 50 soundboards",
      "12 phrases per board, 140 characters each",
      "All preset voices unlocked",
      "Brainrot video generator",
      "Custom voice upload",
      "Manage subscription in the customer portal",
    ],
    priceIdMonthly: getProPriceIdMonthly(),
    priceIdYearly: getProPriceIdYearly(),
  },
} as const

export type PlanKey = keyof typeof PLANS
