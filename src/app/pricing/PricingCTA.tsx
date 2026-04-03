"use client"

import Link from "next/link"
import { useAuth, SignInButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export function PricingCTA({ plan }: { plan: "free" | "pro" }) {
  const { isSignedIn } = useAuth()

  if (plan === "free") {
    return isSignedIn ? (
      <Button asChild variant="outline" className="w-full">
        <Link href="/app">Open dashboard</Link>
      </Button>
    ) : (
      <SignInButton mode="modal">
        <Button variant="outline" className="w-full">
          Get started free
        </Button>
      </SignInButton>
    )
  }

  return (
    <Button asChild className="w-full">
      <Link href="/pricing#pro">See Pro options</Link>
    </Button>
  )
}
