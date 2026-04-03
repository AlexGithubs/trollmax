import { getManifestStore } from "@/lib/storage"
import type { SubscriptionRecord } from "@/lib/manifests/types"

const SUB_KEY = (userId: string) => `user:${userId}:subscription`
export const STRIPE_CUSTOMER_USER_KEY = (customerId: string) =>
  `stripe:customer:${customerId}`

const PRO_STATUSES = new Set([
  "active",
  "trialing",
])

export function parseSubscriptionRecord(raw: string | null): SubscriptionRecord | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as SubscriptionRecord
  } catch {
    return null
  }
}

export function subscriptionGrantsPro(record: SubscriptionRecord | null): boolean {
  if (!record) return false
  const status = record.subscriptionStatus
  if (status && PRO_STATUSES.has(status)) return true
  // Legacy: plan pro without status (treat as inactive)
  if (record.plan === "pro" && !status) return false
  return false
}

export async function getSubscriptionRecord(
  userId: string
): Promise<SubscriptionRecord | null> {
  const store = getManifestStore()
  const raw = await store.get(SUB_KEY(userId))
  return parseSubscriptionRecord(raw)
}

/** True subscription from KV/Stripe (ignores admin billing preview). */
export async function isUserProActual(userId: string): Promise<boolean> {
  const rec = await getSubscriptionRecord(userId)
  return subscriptionGrantsPro(rec)
}


export async function saveSubscriptionRecord(
  userId: string,
  record: SubscriptionRecord
): Promise<void> {
  const store = getManifestStore()
  await store.set(SUB_KEY(userId), JSON.stringify(record))
}

export async function mergeSubscriptionRecord(
  userId: string,
  patch: Partial<SubscriptionRecord>
): Promise<SubscriptionRecord> {
  const cur = (await getSubscriptionRecord(userId)) ?? { plan: "free" as const }
  const next: SubscriptionRecord = { ...cur, ...patch }
  await saveSubscriptionRecord(userId, next)
  return next
}

export async function linkStripeCustomerToUser(
  customerId: string,
  userId: string
): Promise<void> {
  const store = getManifestStore()
  await store.set(STRIPE_CUSTOMER_USER_KEY(customerId), userId)
}

export async function getUserIdForStripeCustomer(
  customerId: string
): Promise<string | null> {
  const store = getManifestStore()
  return store.get(STRIPE_CUSTOMER_USER_KEY(customerId))
}
