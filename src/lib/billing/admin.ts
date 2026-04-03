/**
 * Comma-separated Clerk user IDs allowed to use billing preview (free/pro) overrides.
 * Example: TROLLMAX_BILLING_ADMIN_USER_IDS=user_2abc...,user_2def...
 */
export function listBillingAdminUserIds(): string[] {
  const raw = process.env.TROLLMAX_BILLING_ADMIN_USER_IDS?.trim()
  if (!raw) return []
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export function isBillingAdmin(userId: string | undefined | null): boolean {
  if (!userId) return false
  return listBillingAdminUserIds().includes(userId)
}
