import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { creditBananaCredits } from "@/lib/billing/banana-credits"
import { resolveCreditsFromCheckoutLineItems } from "@/lib/billing/credit-packs"
import { getManifestStore } from "@/lib/storage"
import {
  getUserIdForStripeCustomer,
  linkStripeCustomerToUser,
} from "@/lib/billing/subscription"

const CREDIT_PURCHASE_DONE_KEY = (sessionId: string) =>
  `stripe:credit-purchase:${sessionId}`

export const runtime = "nodejs"

async function grantBananaCreditsFromCheckoutSession(
  stripeClient: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "payment") return
  const metaKind = session.metadata?.purchaseKind?.trim()
  if (metaKind !== "banana_credits") return

  const sessionId = session.id
  const store = getManifestStore()
  const doneKey = CREDIT_PURCHASE_DONE_KEY(sessionId)
  if (await store.get(doneKey)) {
    return
  }

  const full = await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  })

  const lineItems = full.line_items?.data ?? []
  const orderedPriceIds: string[] = []
  for (const item of lineItems) {
    const qty = item.quantity ?? 1
    const price = item.price
    const priceId = typeof price === "string" ? price : price?.id
    if (!priceId) {
      console.error("[stripe webhook] Credit purchase: missing price id on line item", sessionId)
      return
    }
    for (let q = 0; q < qty; q++) {
      orderedPriceIds.push(priceId)
    }
  }

  const resolved = resolveCreditsFromCheckoutLineItems(orderedPriceIds)
  if (!resolved.ok) {
    console.error(
      "[stripe webhook] Credit purchase: could not resolve credits",
      sessionId,
      resolved.error,
      orderedPriceIds
    )
    return
  }

  let userId =
    full.client_reference_id?.trim() ||
    full.metadata?.clerkUserId?.trim() ||
    null

  const customerId =
    typeof full.customer === "string" ? full.customer : full.customer?.id

  if (!userId && customerId) {
    userId = await getUserIdForStripeCustomer(customerId)
  }

  if (!userId && customerId) {
    const customer = await stripeClient.customers.retrieve(customerId)
    if (!customer.deleted && "metadata" in customer && customer.metadata?.clerkUserId) {
      userId = customer.metadata.clerkUserId.trim() || null
    }
  }

  if (!userId) {
    console.error("[stripe webhook] Credit purchase: missing Clerk user", sessionId, customerId)
    return
  }

  if (customerId) {
    await linkStripeCustomerToUser(customerId, userId)
  }

  const metaTotal = full.metadata?.bananaCreditsTotal?.trim()
  if (metaTotal && Number(metaTotal) !== resolved.totalCredits) {
    console.warn(
      "[stripe webhook] Credit purchase: metadata total mismatch, using line items",
      sessionId,
      metaTotal,
      resolved.totalCredits
    )
  }

  await creditBananaCredits(userId, resolved.totalCredits)
  await store.set(doneKey, "1")
  console.log(
    "[stripe webhook] Credited banana credits",
    userId,
    resolved.totalCredits,
    sessionId
  )
}

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET missing" }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    console.error("[stripe webhook] signature:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === "payment") {
          await grantBananaCreditsFromCheckoutSession(stripe, session)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error("[stripe webhook] handler:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
