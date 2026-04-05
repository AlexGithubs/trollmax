"use client"

import { SignInButton } from "@clerk/nextjs"
import { useAuth } from "@clerk/nextjs"
import { Coins, LogIn } from "lucide-react"

export function SignInBalanceLink() {
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary/90 underline-offset-2 hover:text-primary hover:underline"
      >
        <Coins className="h-3 w-3 shrink-0 opacity-80" />
        Sign in to see your balance
      </button>
    </SignInButton>
  )
}

export function SignInMobileButton() {
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
      >
        Sign in
      </button>
    </SignInButton>
  )
}

export function SignInSidebarButton() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return null
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogIn className="h-3.5 w-3.5 shrink-0" />
        <span>Sign in</span>
      </button>
    </SignInButton>
  )
}
