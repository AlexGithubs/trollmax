import Stripe from "stripe"

/** Server Stripe client — credit-pack checkout uses one-time Prices only (see `credit-packs.ts`). */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" })
  : null
