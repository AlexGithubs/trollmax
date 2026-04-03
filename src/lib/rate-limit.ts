/**
 * Simple rate limiter.
 * - In mock/dev (no Upstash): in-memory Map, resets on server restart.
 * - In prod: Upstash Redis INCR + EXPIRE.
 *
 * Higher caps: TROLLMAX_RATE_LIMIT_RELAXED_USER_IDS and/or TROLLMAX_BILLING_ADMIN_USER_IDS
 * (Clerk does not control these — they are app-side limits in this file).
 */
import { isBillingAdmin } from "@/lib/billing/admin"
import { notifyAppRateLimitHit } from "@/lib/ops/rate-limit-alert"

const LIMITS: Record<string, number> = {
  upload: 10, // per hour
  generate: 5, // per hour
  create: 20, // per hour
}

/** Per-hour caps for users listed in TROLLMAX_RATE_LIMIT_RELAXED_USER_IDS */
const RELAXED_LIMITS: Record<string, number> = {
  upload: 500,
  generate: 500,
  create: 500,
}

const WINDOW_MS = 60 * 60 * 1000 // 1 hour

function listRelaxedRateLimitUserIds(): string[] {
  const raw = process.env.TROLLMAX_RATE_LIMIT_RELAXED_USER_IDS?.trim()
  if (!raw) return []
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

function limitForUser(userId: string, action: "upload" | "generate" | "create"): number {
  if (listRelaxedRateLimitUserIds().includes(userId) || isBillingAdmin(userId)) {
    return RELAXED_LIMITS[action]
  }
  return LIMITS[action]
}

// ── In-memory fallback ────────────────────────────────────────────────────────
interface Entry { count: number; resetAt: number }
const mem = new Map<string, Entry>()

function memCheck(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = mem.get(key)

  if (!entry || now > entry.resetAt) {
    mem.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ── KV-backed (prod) ──────────────────────────────────────────────────────────
async function upstashCheck(
  key: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    automaticDeserialization: false,
  })

  const count = await redis.incr(key)

  if (count === 1) {
    // First hit — set TTL
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000))
  }

  if (count > limit) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: limit - count }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function checkRateLimit(
  userId: string,
  action: "upload" | "generate" | "create"
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = limitForUser(userId, action)
  const key = `ratelimit:${userId}:${action}`

  let result: { allowed: boolean; remaining: number }
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.NEXT_PUBLIC_MOCK_MODE !== "true"
  ) {
    result = await upstashCheck(key, limit)
  } else {
    result = memCheck(key, limit)
  }

  if (!result.allowed) {
    notifyAppRateLimitHit(userId, action)
  }

  return result
}
