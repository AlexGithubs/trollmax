"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { SignInButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type Interval = "month" | "year"

export function ProCheckoutButtons({
  monthlyLabel,
  yearlyLabel,
  savingsNote,
}: {
  monthlyLabel: string
  yearlyLabel: string
  savingsNote: string
}) {
  const { isSignedIn } = useAuth()
  const [loading, setLoading] = useState<Interval | null>(null)

  async function startCheckout(interval: Interval) {
    if (!isSignedIn) return
    setLoading(interval)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
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
      setLoading(null)
    }
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button className="w-full">Sign in to upgrade</Button>
      </SignInButton>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        disabled={loading !== null}
        onClick={() => void startCheckout("month")}
      >
        {loading === "month" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          monthlyLabel
        )}
      </Button>
      <Button
        variant="secondary"
        className="w-full"
        disabled={loading !== null}
        onClick={() => void startCheckout("year")}
      >
        {loading === "year" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          yearlyLabel
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">{savingsNote}</p>
    </div>
  )
}
