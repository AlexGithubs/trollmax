import { getManifestStore } from "@/lib/storage"
import type { ManifestStore } from "@/lib/storage/types"
import { isBillingAdmin } from "./admin"
import { VIDEO_GENERATE_BASE_BANANA_CREDITS } from "./video-generation-cost"

export const STARTING_BANANA_CREDITS = 5
export const BILLING_ADMIN_TEST_BANANA_CREDITS = 100

export const BANANA_CREDIT_COSTS = {
  soundboardGenerate: 1,
  videoGenerate: VIDEO_GENERATE_BASE_BANANA_CREDITS,
  soundboardExpansion: 0.5,
} as const

/** Legacy KV key; keep for existing user balances. */
const BALANCE_STORAGE_KEY = (userId: string) => `user:${userId}:doinks`
const ADMIN_SEED_KEY = (userId: string) => `user:${userId}:doinks:admin-seeded`

function roundCredits(n: number): number {
  return Math.max(0, Math.round(n * 100) / 100)
}

/**
 * One-time test grant for billing admins. Does not run on every balance read used by atomic debit.
 */
export async function ensureBillingAdminCreditsSeeded(userId: string): Promise<void> {
  if (!isBillingAdmin(userId)) return
  const store = getManifestStore()
  const seeded = await store.get(ADMIN_SEED_KEY(userId))
  if (seeded) return
  const raw = await store.get(BALANCE_STORAGE_KEY(userId))
  const parsed = raw ? Number(raw) : Number.NaN
  let balance = Number.isFinite(parsed) ? Math.max(0, parsed) : STARTING_BANANA_CREDITS
  balance = Math.max(balance, BILLING_ADMIN_TEST_BANANA_CREDITS)
  await store.set(BALANCE_STORAGE_KEY(userId), String(balance))
  await store.set(ADMIN_SEED_KEY(userId), "1")
}

export async function getBananaCreditsBalance(userId: string): Promise<number> {
  await ensureBillingAdminCreditsSeeded(userId)
  const store = getManifestStore()
  const raw = await store.get(BALANCE_STORAGE_KEY(userId))
  const parsed = raw ? Number(raw) : Number.NaN
  if (Number.isFinite(parsed)) return Math.max(0, parsed)
  return STARTING_BANANA_CREDITS
}

export async function setBananaCreditsBalance(userId: string, amount: number): Promise<number> {
  const store = getManifestStore()
  const rounded = roundCredits(amount)
  await store.set(BALANCE_STORAGE_KEY(userId), String(rounded))
  return rounded
}

async function legacyTryDecrementNumeric(
  store: ManifestStore,
  key: string,
  amount: number,
  defaultIfMissing: number
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  const cost = roundCredits(amount)
  const raw = await store.get(key)
  const parsed = raw ? Number(raw) : Number.NaN
  const bal = Number.isFinite(parsed) ? Math.max(0, parsed) : roundCredits(defaultIfMissing)
  if (bal < cost - 1e-9) {
    return { ok: false, balance: bal }
  }
  const next = roundCredits(bal - cost)
  await store.set(key, String(next))
  return { ok: true, balance: next }
}

/**
 * Atomically subtract credits if the user has enough. Call after {@link ensureBillingAdminCreditsSeeded}
 * (included in {@link getBananaCreditsBalance} / {@link canAffordBananaCredits}).
 */
export async function tryDebitBananaCredits(
  userId: string,
  amount: number
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  await ensureBillingAdminCreditsSeeded(userId)
  const store = getManifestStore()
  const key = BALANCE_STORAGE_KEY(userId)
  if (typeof store.tryDecrementNumeric === "function") {
    return store.tryDecrementNumeric(key, amount, STARTING_BANANA_CREDITS)
  }
  // The legacy path is a non-atomic read-modify-write and is unsafe under concurrency.
  // In production, always configure Upstash Redis so the atomic Lua path is used.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL: atomic credit debit unavailable in production. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable it."
    )
  }
  return legacyTryDecrementNumeric(store, key, amount, STARTING_BANANA_CREDITS)
}

/** Maximum balance any user can hold (prevents credit inflation exploits). */
const MAX_BANANA_CREDITS_BALANCE = 9999

/**
 * Atomically refund credits after a failed generation.
 * Uses Lua script on Upstash so concurrent refunds can't race;
 * falls back to read-modify-write in dev/mock (single-threaded).
 */
export async function creditBananaCredits(userId: string, amount: number): Promise<number> {
  const store = getManifestStore()
  const key = BALANCE_STORAGE_KEY(userId)
  if (typeof store.incrementNumeric === "function") {
    return store.incrementNumeric(key, amount, STARTING_BANANA_CREDITS, MAX_BANANA_CREDITS_BALANCE)
  }
  // Fallback (dev/mock only — never reached in production due to hard-fail in tryDebitBananaCredits)
  const raw = await store.get(key)
  const parsed = raw ? Number(raw) : Number.NaN
  const cur = Number.isFinite(parsed) ? Math.max(0, parsed) : STARTING_BANANA_CREDITS
  const next = roundCredits(Math.min(cur + amount, MAX_BANANA_CREDITS_BALANCE))
  await store.set(key, String(next))
  return next
}

/** @deprecated Prefer {@link tryDebitBananaCredits} for generation flows. */
export async function spendBananaCredits(userId: string, amount: number): Promise<number> {
  const r = await tryDebitBananaCredits(userId, amount)
  if (!r.ok) {
    throw new Error("INSUFFICIENT_BANANA_CREDITS")
  }
  return r.balance
}

export async function canAffordBananaCredits(userId: string, amount: number): Promise<boolean> {
  const current = await getBananaCreditsBalance(userId)
  return current >= amount
}
