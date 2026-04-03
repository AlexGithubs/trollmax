import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { creditBananaCredits } from "@/lib/billing/banana-credits"
import { resolveCreditsFromCheckoutLineItems } from "@/lib/billing/credit-packs"
import { getManifestStore } from "@/lib/storage"
import {
  getUserIdForStripeCustomer,
  linkStripeCustomerToUser,
  mergeSubscriptionRecord,
} from "@/lib/billing/subscription"

const CREDIT_PURCHASE_DONE_KEY = (sessionId: string) =>
  `stripe:credit-purchase:${sessionId}`

export const runtime = "nodejs"

async function applySubscription(
  stripeClient: Stripe,
  subscription: Stripe.Subscription,
  fallbackUserId: string | null | undefined
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  let userId =
    subscription.metadata?.clerkUserId?.trim() ||
    fallbackUserId?.trim() ||
    null

  if (!userId) {
    userId = await getUserIdForStripeCustomer(customerId)
  }

  if (!userId) {
    const customer = await stripeClient.customers.retrieve(customerId)
    if (!customer.deleted && "metadata" in customer && customer.metadata?.clerkUserId) {
      userId = customer.metadata.clerkUserId
    }
  }

  if (!userId) {
    console.error(
      "[stripe webhook] Missing Clerk user for subscription",
      subscription.id,
      customerId
    )
    return
  }

  await linkStripeCustomerToUser(customerId, userId)

  const status = subscription.status
  const entitled = status === "active" || status === "trialing"
  const firstItem = subscription.items.data[0]
  const price = firstItem?.price
  const interval: "month" | "year" =
    price?.recurring?.interval === "year" ? "year" : "month"
  const periodEndSec = firstItem?.current_period_end

  await mergeSubscriptionRecord(userId, {
    plan: entitled ? "pro" : "free",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    currentPeriodEnd:
      periodEndSec != null
        ? new Date(periodEndSec * 1000).toISOString()
        : undefined,
    priceInterval: interval,
  })
}

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
          break
        }
        if (session.mode !== "subscription") break
        const userId = session.client_reference_id
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id
        if (customerId && userId) {
          await linkStripeCustomerToUser(customerId, userId)
        }
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await applySubscription(stripe, sub, userId)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await applySubscription(stripe, sub, null)
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
