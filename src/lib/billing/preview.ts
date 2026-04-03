import { cookies } from "next/headers"
import { isBillingAdmin } from "./admin"
import { getSubscriptionRecord, subscriptionGrantsPro } from "./subscription"

export const BILLING_PREVIEW_COOKIE = "trollmax_billing_preview"

export type BillingPreviewMode = "actual" | "free" | "pro"

export interface BillingAccess {
  /** Entitlement checks (UI + API) should use this */
  effectiveIsPro: boolean
  /** Real Stripe/KV subscription state */
  actualIsPro: boolean
  /** Cookie value when admin; always "actual" for non-admins */
  previewMode: BillingPreviewMode
  /** True when admin has selected free or pro preview */
  previewActive: boolean
}

function parsePreviewCookie(value: string | undefined): BillingPreviewMode {
  if (value === "free" || value === "pro" || value === "actual") return value
  return "actual"
}

export async function resolveBillingAccess(userId: string): Promise<BillingAccess> {
  const record = await getSubscriptionRecord(userId)
  const actualIsPro = subscriptionGrantsPro(record)

  if (!isBillingAdmin(userId)) {
    return {
      effectiveIsPro: actualIsPro,
      actualIsPro,
      previewMode: "actual",
      previewActive: false,
    }
  }

  const jar = await cookies()
  const mode = parsePreviewCookie(jar.get(BILLING_PREVIEW_COOKIE)?.value)

  if (mode === "free") {
    return {
      effectiveIsPro: false,
      actualIsPro,
      previewMode: "free",
      previewActive: true,
    }
  }
  if (mode === "pro") {
    return {
      effectiveIsPro: true,
      actualIsPro,
      previewMode: "pro",
      previewActive: true,
    }
  }

  return {
    effectiveIsPro: actualIsPro,
    actualIsPro,
    previewMode: "actual",
    previewActive: false,
  }
}

/** Effective Pro access for product behavior (respects admin free/pro preview). */
export async function isUserPro(userId: string): Promise<boolean> {
  const { effectiveIsPro } = await resolveBillingAccess(userId)
  return effectiveIsPro
}
