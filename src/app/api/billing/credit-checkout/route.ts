import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { CREDIT_PACKS, validateCheckoutSelection } from "@/lib/billing/credit-packs"
import {
  getSubscriptionRecord,
  mergeSubscriptionRecord,
} from "@/lib/billing/subscription"

const BodySchema = z.object({
  packId: z.enum(["starter", "growth", "scale"]),
})

function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  return new URL(req.url).origin
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured (missing STRIPE_SECRET_KEY)." },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body: packId required" }, { status: 400 })
  }

  const sel = validateCheckoutSelection(parsed.data.packId)
  if (!sel.ok) {
    return NextResponse.json({ error: sel.error }, { status: 400 })
  }

  const packId = sel.packId
  const pack = CREDIT_PACKS[packId]
  const packPriceId = process.env[pack.stripePriceEnv]?.trim() || null
  if (!packPriceId) {
    return NextResponse.json(
      {
        error: `Credit pack billing is not configured (set ${pack.stripePriceEnv}).`,
      },
      { status: 503 }
    )
  }

  const origin = appOrigin(req)

  let customerId = (await getSubscriptionRecord(user.id))?.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.primaryEmailAddress?.emailAddress ?? undefined,
      name: user.fullName ?? undefined,
      metadata: { clerkUserId: user.id },
    })
    customerId = customer.id
    await mergeSubscriptionRecord(user.id, { stripeCustomerId: customerId })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: packPriceId, quantity: 1 }],
      /** Required when Dashboard has no compatible methods enabled for dynamic PMs. */
      payment_method_types: ["card"],
      success_url: `${origin}/app?credit_purchase=success`,
      cancel_url: `${origin}/pricing/checkout?pack=${packId}&credit_purchase=canceled`,
      metadata: {
        clerkUserId: user.id,
        creditPackId: packId,
        bananaCreditsTotal: String(sel.totalCredits),
        purchaseKind: "banana_credits",
      },
      payment_intent_data: {
        metadata: {
          clerkUserId: user.id,
          creditPackId: packId,
          bananaCreditsTotal: String(sel.totalCredits),
          purchaseKind: "banana_credits",
        },
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error("[credit-checkout]", err)
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Checkout failed"
    const raw =
      err instanceof Stripe.errors.StripeError && typeof err.statusCode === "number"
        ? err.statusCode
        : 502
    const status = raw >= 400 && raw < 600 ? raw : 502
    return NextResponse.json({ error: message }, { status })
  }
}
