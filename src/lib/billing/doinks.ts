import { getManifestStore } from "@/lib/storage"
import { isBillingAdmin } from "./admin"

export const STARTING_DOINKS = 5
export const BILLING_ADMIN_TEST_DOINKS = 100

export const DOINK_COSTS = {
  soundboardGenerate: 1,
  videoGenerate: 2,
  soundboardExpansion: 0.5,
} as const

const DOINKS_KEY = (userId: string) => `user:${userId}:doinks`
const ADMIN_SEED_KEY = (userId: string) => `user:${userId}:doinks:admin-seeded`

export async function getDoinksBalance(userId: string): Promise<number> {
  const store = getManifestStore()
  const raw = await store.get(DOINKS_KEY(userId))
  const parsed = raw ? Number(raw) : Number.NaN
  let balance = Number.isFinite(parsed) ? Math.max(0, parsed) : STARTING_DOINKS

  // Dev/test convenience: billing-admin users are seeded once with a larger balance.
  if (isBillingAdmin(userId)) {
    const seeded = await store.get(ADMIN_SEED_KEY(userId))
    if (!seeded) {
      balance = Math.max(balance, BILLING_ADMIN_TEST_DOINKS)
      await store.set(DOINKS_KEY(userId), String(balance))
      await store.set(ADMIN_SEED_KEY(userId), "1")
    }
  }

  return balance
}

export async function setDoinksBalance(userId: string, amount: number): Promise<number> {
  const store = getManifestStore()
  const rounded = Math.max(0, Math.round(amount * 100) / 100)
  await store.set(DOINKS_KEY(userId), String(rounded))
  return rounded
}

export async function spendDoinks(userId: string, amount: number): Promise<number> {
  const current = await getDoinksBalance(userId)
  const next = current - amount
  if (next < 0) {
    throw new Error("INSUFFICIENT_DOINKS")
  }
  return setDoinksBalance(userId, next)
}

export async function canAffordDoinks(userId: string, amount: number): Promise<boolean> {
  const current = await getDoinksBalance(userId)
  return current >= amount
}
