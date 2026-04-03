"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { BillingPreviewMode } from "@/lib/billing/preview"

export function BillingPreviewSwitcher({
  enabled,
  initialMode,
  initialActualPro,
}: {
  enabled: boolean
  initialMode: BillingPreviewMode
  initialActualPro: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<BillingPreviewMode>(initialMode)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  async function onChange(next: BillingPreviewMode) {
    const res = await fetch("/api/billing/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    })
    if (!res.ok) return
    setMode(next)
    router.refresh()
  }

  if (!enabled) return null

  return (
    <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-amber-950 dark:text-amber-100">
        Admin · billing preview
      </p>
      <label className="sr-only" htmlFor="billing-preview-mode">
        Billing preview mode
      </label>
      <select
        id="billing-preview-mode"
        className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-foreground outline-none focus:border-primary/50"
        value={mode}
        onChange={(e) => void onChange(e.target.value as BillingPreviewMode)}
      >
        <option value="actual">
          Real subscription ({initialActualPro ? "Pro" : "Free"})
        </option>
        <option value="free">Preview as Free user</option>
        <option value="pro">Preview as Pro user</option>
      </select>
      {(mode === "free" || mode === "pro") && (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
          UI and API use this tier until you switch back. Stripe and webhooks are unchanged.
        </p>
      )}
    </div>
  )
}
