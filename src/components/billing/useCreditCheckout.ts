"use client"

import { useCallback, useState } from "react"
import type { CreditPackId } from "@/lib/billing/credit-packs"
import { savePendingGeneration, type PendingGeneration } from "@/lib/client/pending-generation"

type StartCheckoutArgs = {
  packId: CreditPackId
  successPath?: string
  pending?: Omit<PendingGeneration, "requiredCredits"> & { requiredCredits: number }
}

export function useCreditCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = useCallback(async ({ packId, successPath, pending }: StartCheckoutArgs) => {
    setLoading(true)
    setError(null)
    try {
      if (pending) {
        savePendingGeneration({
          product: pending.product,
          manifestId: pending.manifestId,
          requiredCredits: pending.requiredCredits,
          returnPath: pending.returnPath,
        })
      }

      const res = await fetch("/api/billing/credit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, successPath }),
      })
      const text = await res.text()
      let data: { url?: string; error?: string } = {}
      if (text.trim()) {
        try {
          data = JSON.parse(text) as { url?: string; error?: string }
        } catch {
          throw new Error(text.slice(0, 200) || `Server error (${res.status})`)
        }
      }
      if (!res.ok) {
        throw new Error(data.error ?? `Checkout failed (${res.status})`)
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error("No checkout URL returned")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checkout failed"
      setError(msg)
      setLoading(false)
    }
  }, [])

  return { startCheckout, loading, error }
}
