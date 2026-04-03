"use client"

import { useCallback, useMemo, useState } from "react"
import { useAuth, SignInButton } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Button } from "@/components/ui/button"
import { currencyIconSrc, currencyNamePluralLower } from "@/lib/billing/currency-display"
import {
  FEATURED_CREDIT_PACK_ID,
  RACK_USD_PER_CREDIT,
  type CreditPackId,
  type CreditPackPublic,
} from "@/lib/billing/credit-packs"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

export function CreditCheckoutClient({
  packs,
  initialPackId,
  canceled,
}: {
  packs: CreditPackPublic[]
  initialPackId: CreditPackId
  canceled: boolean
}) {
  const { isSignedIn } = useAuth()
  const [packId, setPackId] = useState<CreditPackId>(initialPackId)
  const [loading, setLoading] = useState(false)

  const selected = useMemo(
    () => packs.find((p) => p.id === packId) ?? packs[0],
    [packs, packId]
  )

  const startCheckout = useCallback(async () => {
    if (!isSignedIn) return
    setLoading(true)
    try {
      const res = await fetch("/api/billing/credit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Checkout failed")
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error("No checkout URL returned")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed")
      setLoading(false)
    }
  }, [isSignedIn, packId])

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex flex-1 flex-col lg:flex-row lg:min-h-[calc(100dvh-3.5rem)]">
        <aside className="flex flex-col justify-between border-b border-border/50 bg-background px-6 py-10 md:px-10 md:py-14 lg:w-[min(100%,420px)] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-11 lg:py-16">
          <div>
            <Link
              href="/pricing"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Pricing
            </Link>

            <p className="mt-12 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Checkout
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-[1.75rem] md:leading-snug">
              Banana credits
            </h1>

            <div className="mt-12 flex flex-wrap items-end gap-x-3 gap-y-0.5">
              <span className="text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums md:text-5xl">
                {money(selected.priceUsd)}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {selected.credits} {currencyNamePluralLower()} · {money(selected.usdPerCredit)} each
            </p>

            {canceled ? (
              <p className="mt-8 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                Payment was canceled. Choose a pack and try again.
              </p>
            ) : null}

            <div className="mt-10 rounded-2xl border border-border/45 bg-card/25 px-5 py-5">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{selected.label}</span>
                <span className="tabular-nums font-medium">{money(selected.priceUsd)}</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-border/40 pt-4 text-sm">
                <span className="text-muted-foreground">Total due</span>
                <span className="tabular-nums text-base font-semibold">
                  {money(selected.priceUsd)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-14 lg:mt-20">
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <Button size="lg" className="h-12 w-full rounded-xl text-sm font-medium">
                  Sign in to continue
                </Button>
              </SignInButton>
            ) : (
              <Button
                size="lg"
                className="h-12 w-full rounded-xl text-sm font-medium"
                disabled={loading}
                onClick={() => void startCheckout()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening Stripe…
                  </>
                ) : (
                  "Pay with Stripe"
                )}
              </Button>
            )}
            <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground/75">
              Secure payment · You’ll finish on Stripe’s page
            </p>
          </div>
        </aside>

        <div className="flex flex-1 flex-col justify-center bg-muted/[0.06] px-6 py-12 md:px-12 md:py-16 lg:px-16 lg:py-20">
          <div className="mx-auto w-full max-w-md">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Select pack
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Higher tiers lower your cost per credit vs {money(RACK_USD_PER_CREDIT)} rack.
            </p>

            <div className="mt-10 flex flex-col gap-3">
              {packs.map((p) => {
                const active = p.id === packId
                const featured = p.id === FEATURED_CREDIT_PACK_ID
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPackId(p.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-6 rounded-2xl border px-5 py-5 text-left transition-colors md:px-6 md:py-6",
                      active
                        ? "border-primary/45 bg-primary/[0.08]"
                        : "border-border/40 bg-background/40 hover:border-border/70",
                      featured && !active ? "ring-1 ring-primary/15" : ""
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.label}</span>
                        {featured ? (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-primary/90">
                            Popular
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.credits} credits · save {p.savingsVsRackPercent}%
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">
                      {money(p.priceUsd)}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
              <Image
                src={currencyIconSrc()}
                alt=""
                width={14}
                height={14}
                className="opacity-80"
              />
              Need API access or custom terms?{" "}
              <Link
                href="/pricing#enterprise"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Enterprise
              </Link>
            </p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
