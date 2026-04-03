import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { stripe } from "@/lib/stripe"
import { getSubscriptionRecord } from "@/lib/billing/subscription"

function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  return new URL(req.url).origin
}

export async function POST(_req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured (missing STRIPE_SECRET_KEY)." },
      { status: 503 }
    )
  }

  const record = await getSubscriptionRecord(user.id)
  const customerId = record?.stripeCustomerId
  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer on file. Subscribe from the pricing page first." },
      { status: 400 }
    )
  }

  const origin = appOrigin(_req)
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/app`,
  })

  return NextResponse.json({ url: session.url })
}
