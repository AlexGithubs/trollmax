"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard } from "lucide-react"

export function ManageBillingButton({
  className,
  size = "sm",
  variant = "outline",
}: {
  className?: string
  size?: "sm" | "default"
  variant?: "outline" | "ghost" | "secondary"
}) {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not open billing portal")
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error("No portal URL returned")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={() => void openPortal()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
          Manage billing
        </>
      )}
    </Button>
  )
}
