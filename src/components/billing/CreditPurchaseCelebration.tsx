"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { currencyIconSrc } from "@/lib/billing/currency-display"
import { emitBananaCreditsUpdated } from "@/lib/client/banana-credits-bridge"
import {
  readPendingGeneration,
  clearPendingGeneration,
  type PendingGeneration,
} from "@/lib/client/pending-generation"
import {
  dispatchPendingGenerationResume,
  pollUntilCredits,
} from "@/lib/client/resume-generation"
import { X } from "lucide-react"

function pendingContinueLabel(pending: PendingGeneration): string {
  return pending.product === "video" ? "Continue your video" : "Continue your soundboard"
}

function CelebrationInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const handledRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [creditsAdded, setCreditsAdded] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingGeneration | null>(null)
  const [resumeFailed, setResumeFailed] = useState(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams.get("credit_purchase") !== "success") return
    handledRef.current = true

    const creditsRaw = searchParams.get("credits_added")
    const credits = creditsRaw ? Number(creditsRaw) : null
    if (typeof credits === "number" && Number.isFinite(credits)) {
      setCreditsAdded(credits)
    }

    const pendingGen = readPendingGeneration()
    setPending(pendingGen)

    const required = pendingGen?.requiredCredits ?? 0

    void (async () => {
      const balance = required > 0 ? await pollUntilCredits(required) : null
      if (balance !== null) {
        emitBananaCreditsUpdated(balance)
      } else {
        try {
          const res = await fetch("/api/billing/entitlement")
          if (res.ok) {
            const data = (await res.json()) as { bananaCreditsBalance?: number }
            if (typeof data.bananaCreditsBalance === "number") {
              emitBananaCreditsUpdated(data.bananaCreditsBalance)
            }
          }
        } catch {
          // non-fatal
        }
      }

      if (pendingGen) {
        if (balance !== null && balance >= required) {
          dispatchPendingGenerationResume({
            product: pendingGen.product,
            manifestId: pendingGen.manifestId,
          })
          setToast(
            `+${credits ?? "New"} credits added — resuming your ${pendingGen.product === "video" ? "video" : "soundboard"}…`
          )
          window.setTimeout(() => setToast(null), 6000)
        } else {
          setResumeFailed(true)
          setModalOpen(true)
        }
      } else {
        setModalOpen(true)
      }

      const next = new URLSearchParams(searchParams.toString())
      next.delete("credit_purchase")
      next.delete("pack")
      next.delete("credits_added")
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })()
  }, [searchParams, pathname, router])

  const handleContinue = () => {
    if (!pending) return
    dispatchPendingGenerationResume({
      product: pending.product,
      manifestId: pending.manifestId,
    })
    setModalOpen(false)
    if (pathname !== pending.returnPath) {
      router.push(pending.returnPath)
    }
  }

  const handleDismiss = () => {
    setModalOpen(false)
    clearPendingGeneration()
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[80] w-[min(100%,24rem)] -translate-x-1/2 rounded-xl border border-primary/40 bg-card px-4 py-3 text-center text-sm font-medium shadow-lg shadow-primary/10 lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-purchase-title"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-2xl shadow-primary/20">
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <Image
                  key={i}
                  src={currencyIconSrc()}
                  alt=""
                  width={24}
                  height={24}
                  className="credit-purchase-particle absolute left-1/2 top-1/2 h-6 w-6 object-contain opacity-80"
                  style={{ ["--particle-i" as string]: i } as React.CSSProperties}
                />
              ))}
            </div>

            <div className="relative">
              <div className="credit-purchase-bounce mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                <Image
                  src={currencyIconSrc()}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 object-contain"
                />
              </div>
              <h2 id="credit-purchase-title" className="text-xl font-bold tracking-tight">
                Credits added!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {creditsAdded != null ? (
                  <>
                    <span className="font-semibold text-foreground">+{creditsAdded}</span> banana credits
                    are now on your account.
                  </>
                ) : (
                  "Your banana credits are ready to use."
                )}
              </p>

              <div className="mt-6 flex flex-col gap-2">
                {pending ? (
                  <Button className="w-full" onClick={handleContinue}>
                    {resumeFailed
                      ? "Continue where you left off"
                      : pendingContinueLabel(pending)}
                  </Button>
                ) : null}
                <Button
                  variant={pending ? "outline" : "default"}
                  className="w-full"
                  onClick={handleDismiss}
                >
                  {pending ? "Not now" : "Got it"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function CreditPurchaseCelebration() {
  return (
    <Suspense fallback={null}>
      <CelebrationInner />
    </Suspense>
  )
}
