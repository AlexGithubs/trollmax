"use client"

import Link from "next/link"
import { useAuth, SignInButton } from "@clerk/nextjs"
import { AppUserButton } from "@/components/layout/AppUserButton"
import { Button } from "@/components/ui/button"
import { Zap } from "lucide-react"

export function SiteHeader() {
  const { isSignedIn } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Zap className="h-5 w-5 text-primary fill-primary" />
          <span className="text-foreground">TROLLMAX</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/app">Dashboard</Link>
              </Button>
              <AppUserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">Sign in</Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button size="sm">Get started</Button>
              </SignInButton>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
