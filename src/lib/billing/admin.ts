/**
 * Operator / admin Clerk user IDs (comma-separated).
 *
 * **Primary:** `TROLLMAX_ADMIN_USER_IDS` — one list for:
 * - Higher banana credit floor (see banana-credits / doinks)
 * - Relaxed per-hour API rate limits (upload / generate / create)
 * - In-app billing preview (free/pro overrides)
 *
 * **Legacy (merged into the same admin set):** `TROLLMAX_BILLING_ADMIN_USER_IDS`
 *
 * **Legacy (rate limits only, not billing/credits):** `TROLLMAX_RATE_LIMIT_RELAXED_USER_IDS`
 * Prefer moving those IDs into `TROLLMAX_ADMIN_USER_IDS`.
 */
export function listAdminUserIds(): string[] {
  const merged = [process.env.TROLLMAX_ADMIN_USER_IDS, process.env.TROLLMAX_BILLING_ADMIN_USER_IDS]
    .filter(Boolean)
    .join(",")
  if (!merged.trim()) return []
  return [...new Set(merged.split(",").map((id) => id.trim()).filter(Boolean))]
}

/** @deprecated Use {@link listAdminUserIds} */
export function listBillingAdminUserIds(): string[] {
  return listAdminUserIds()
}

export function isBillingAdmin(userId: string | undefined | null): boolean {
  if (!userId) return false
  return listAdminUserIds().includes(userId)
}

function listLegacyRateLimitRelaxedUserIds(): string[] {
  const raw = process.env.TROLLMAX_RATE_LIMIT_RELAXED_USER_IDS?.trim()
  if (!raw) return []
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

/** True if this user gets relaxed upload/generate/create hourly caps. */
export function hasElevatedRateLimit(userId: string): boolean {
  return listAdminUserIds().includes(userId) || listLegacyRateLimitRelaxedUserIds().includes(userId)
}
