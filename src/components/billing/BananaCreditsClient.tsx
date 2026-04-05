"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Coins } from "lucide-react"
import { currencyIconAlt, currencyIconSrc } from "@/lib/billing/currency-display"
import { BANANA_CREDITS_UPDATED_EVENT } from "@/lib/client/banana-credits-bridge"
import { SignInBalanceLink } from "@/components/layout/SignInLink"

type Props = {
  initialBalance: number
  signedIn: boolean
  variant: "sidebar" | "mobile"
}

/**
 * Client-side banana balance so the UI updates after generation without a full reload.
 * Server passes `initialBalance`; listens for `BANANA_CREDITS_UPDATED_EVENT`.
 */
export function BananaCreditsClient({ initialBalance, signedIn, variant }: Props) {
  const [balance, setBalance] = useState(initialBalance)

  useEffect(() => {
    setBalance(initialBalance)
  }, [initialBalance])

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent<{ balance?: number }>).detail
      if (typeof d?.balance === "number") setBalance(d.balance)
    }
    window.addEventListener(BANANA_CREDITS_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(BANANA_CREDITS_UPDATED_EVENT, onUpdate)
  }, [])

  if (!signedIn) {
    if (variant === "sidebar") {
      return (
        <>
          <p className="mt-1 text-[11px] text-muted-foreground">
            New accounts start with 5 free banana credits.
          </p>
          <SignInBalanceLink />
        </>
      )
    }
    return null
  }

  if (variant === "mobile") {
    return (
      <Link
        data-tour="credits-widget"
        href="/pricing"
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold hover:bg-primary/20 transition-colors"
      >
        {balance}
        <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-6 w-6 object-contain" />
      </Link>
    )
  }

  return (
    <>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-foreground">
        {balance}
        <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-7 w-7 object-contain" />
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Spend banana credits to generate videos and soundboards
      </p>
      <Link
        data-tour="credits-link"
        href="/pricing"
        className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary/90 underline-offset-2 hover:text-primary hover:underline"
      >
        <Coins className="h-3 w-3 shrink-0 opacity-80" />
        Get more for your balance
      </Link>
    </>
  )
}
