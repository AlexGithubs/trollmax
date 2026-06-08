"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  CREDIT_PACKS,
  FEATURED_CREDIT_PACK_ID,
} from "@/lib/billing/credit-packs"
import { isLocalhostClient } from "@/lib/client/is-localhost"
import { savePendingGeneration } from "@/lib/client/pending-generation"
import { useCreditCheckout } from "./useCreditCheckout"

type Props = {
  product: "video" | "soundboard"
  balance: number
  required: number
  manifestId: string
  returnPath: string
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

export function CreditInsufficientPaywall({
  product,
  balance,
  required,
  manifestId,
  returnPath,
}: Props) {
  const { startCheckout, loading, error } = useCreditCheckout()
  const packId = FEATURED_CREDIT_PACK_ID
  const pack = CREDIT_PACKS[packId]
  const devCheckout = isLocalhostClient()
  const pricingHref = `/pricing/checkout?pack=${packId}&return=${encodeURIComponent(returnPath)}`

  useEffect(() => {
    if (!manifestId) return
    savePendingGeneration({
      product,
      manifestId,
      requiredCredits: required,
      returnPath,
    })
  }, [product, manifestId, required, returnPath])

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card/40 p-5 space-y-4">
      <Button
        className="h-12 w-full text-base font-semibold"
        disabled={loading}
        onClick={() =>
          void startCheckout({
            packId,
            successPath: returnPath,
            pending: {
              product,
              manifestId,
              requiredCredits: required,
              returnPath,
            },
          })
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {devCheckout ? "Adding credits…" : "Opening checkout…"}
          </>
        ) : (
          <>
            {pack.label} pack · {pack.credits} credits · {money(pack.priceUsd)}
          </>
        )}
      </Button>

      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}

      <p className="text-center text-xs text-muted-foreground">
        <Link href={pricingHref} className="underline-offset-2 hover:text-foreground hover:underline">
          See all packs
        </Link>
        {devCheckout ? <span className="ml-1.5">· dev: instant, no card</span> : null}
      </p>
    </div>
  )
}
