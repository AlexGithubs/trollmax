import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { stripe, getProPriceId } from "@/lib/stripe"
import {
  getSubscriptionRecord,
  mergeSubscriptionRecord,
} from "@/lib/billing/subscription"

const BodySchema = z.object({
  interval: z.enum(["month", "year"]),
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
    return NextResponse.json({ error: "Invalid body: need interval month|year" }, { status: 400 })
  }

  const priceId = getProPriceId(parsed.data.interval)
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          parsed.data.interval === "year"
            ? "Yearly billing is not configured (set STRIPE_PRO_PRICE_ID_YEARLY)."
            : "Monthly billing is not configured (set STRIPE_PRO_PRICE_ID_MONTHLY or STRIPE_PRO_PRICE_ID).",
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app?billing=success`,
    cancel_url: `${origin}/pricing?billing=canceled`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { clerkUserId: user.id },
    },
    metadata: { clerkUserId: user.id },
  })

  if (!session.url) {
    return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
