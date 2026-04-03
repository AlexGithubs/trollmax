/**
 * Banana credit one-time packs — Stripe Checkout `payment` mode (one line item per purchase).
 *
 * Create matching one-time Prices in Stripe; set env vars below. Amounts must match `priceUsd`.
 *
 * Margin guardrails (indicative — tune from provider bills):
 * - Lowest effective $/credit ≈ Scale pack (~$0.625 at 120 / $74.99).
 * - Minimum video debit: 2 credits → compare to your D-ID + TTS + compose average.
 */

export const RACK_USD_PER_CREDIT = 0.99

export type CreditPackId = "starter" | "growth" | "scale"

/** Middle tier — highlighted on pricing / checkout */
export const FEATURED_CREDIT_PACK_ID: CreditPackId = "growth"

type PackDef = {
  id: CreditPackId
  label: string
  credits: number
  priceUsd: number
  stripePriceEnv: string
}

export const CREDIT_PACKS: Record<CreditPackId, PackDef> = {
  starter: {
    id: "starter",
    label: "Starter",
    credits: 25,
    priceUsd: 17.99,
    stripePriceEnv: "STRIPE_CREDIT_PACK_STARTER_PRICE_ID",
  },
  growth: {
    id: "growth",
    label: "Growth",
    credits: 60,
    priceUsd: 39.99,
    stripePriceEnv: "STRIPE_CREDIT_PACK_GROWTH_PRICE_ID",
  },
  scale: {
    id: "scale",
    label: "Scale",
    credits: 120,
    priceUsd: 74.99,
    stripePriceEnv: "STRIPE_CREDIT_PACK_SCALE_PRICE_ID",
  },
}

export const CREDIT_PACK_IDS = Object.keys(CREDIT_PACKS) as CreditPackId[]

/** Marketing + checkout (no Stripe secrets). */
export type CreditPackPublic = {
  id: CreditPackId
  label: string
  credits: number
  priceUsd: number
  usdPerCredit: number
  savingsVsRackPercent: number
  /** Tier comparison lines for pricing cards */
  features: string[]
}

export function getCreditPacksForPublic(): CreditPackPublic[] {
  return CREDIT_PACK_IDS.map((id) => {
    const p = CREDIT_PACKS[id]
    const usdPerCredit = effectiveUsdPerCredit(p.credits, p.priceUsd)
    const perCredit = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(usdPerCredit)

    let features: string[]
    if (id === "starter") {
      features = [
        `${p.credits} banana credits`,
        "Soundboards + brainrot video generator",
        `${perCredit} effective per credit`,
        `${Math.round((1 - usdPerCredit / RACK_USD_PER_CREDIT) * 100)}% below ${RACK_USD_PER_CREDIT.toFixed(2)} rack`,
      ]
    } else if (id === "growth") {
      features = [
        "Everything in Starter",
        `${p.credits} banana credits`,
        `${perCredit} per credit — better value`,
        "Best for weekly creators",
      ]
    } else {
      features = [
        "Everything in Growth",
        `${p.credits} banana credits`,
        `${perCredit} per credit — best rate`,
        "Built for volume and teams",
      ]
    }

    return {
      id,
      label: p.label,
      credits: p.credits,
      priceUsd: p.priceUsd,
      usdPerCredit,
      savingsVsRackPercent: Math.round(
        (1 - usdPerCredit / RACK_USD_PER_CREDIT) * 100
      ),
      features,
    }
  })
}

/** Enterprise is sales-led; APIs ship later — UI only until checkout exists. */
export const ENTERPRISE_CREDIT_OFFERING = {
  id: "enterprise" as const,
  label: "Enterprise",
  /** Shown on pricing card subline */
  tagline: "APIs · invoicing · custom limits",
  blurb: "For teams and products that need programmatic access, custom limits, and invoicing.",
  bullets: [
    "HTTP API for generations & assets (coming soon)",
    "Custom credit pools and annual terms",
    "SSO, security review, and priority support",
  ] as const,
  cta: "Contact us",
  mailtoHref: "mailto:hello@trollmax.io?subject=TROLLMAX%20Enterprise",
}

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim()
  return v || null
}

export function getPackStripePriceId(packId: CreditPackId): string | null {
  return readEnv(CREDIT_PACKS[packId].stripePriceEnv)
}

export type CheckoutSelection =
  | { ok: true; packId: CreditPackId; totalCredits: number }
  | { ok: false; error: string }

export function validateCheckoutSelection(packId: string): CheckoutSelection {
  if (!(packId in CREDIT_PACKS)) {
    return { ok: false, error: "Invalid pack" }
  }
  const p = packId as CreditPackId
  return {
    ok: true,
    packId: p,
    totalCredits: CREDIT_PACKS[p].credits,
  }
}

export function effectiveUsdPerCredit(credits: number, usd: number): number {
  if (credits <= 0) return 0
  return Math.round((usd / credits) * 1000) / 1000
}

/**
 * Stripe Checkout line items: exactly one known pack price ID.
 */
export function resolveCreditsFromCheckoutLineItems(
  orderedPriceIds: string[]
):
  | { ok: true; totalCredits: number; packId: CreditPackId }
  | { ok: false; error: string } {
  if (orderedPriceIds.length !== 1) {
    return { ok: false, error: "Invalid credit purchase line item count" }
  }
  for (const pack of Object.values(CREDIT_PACKS)) {
    const packPrice = readEnv(pack.stripePriceEnv)
    if (packPrice && orderedPriceIds[0] === packPrice) {
      return { ok: true, totalCredits: pack.credits, packId: pack.id }
    }
  }
  return { ok: false, error: "Line item does not match a configured credit pack" }
}
