"use client"

import Link from "next/link"
import { useState } from "react"
import { useAuth, SignInButton } from "@clerk/nextjs"
import { AppUserButton } from "@/components/layout/AppUserButton"
import { Button } from "@/components/ui/button"
import { Menu, X, Zap } from "lucide-react"

export function SiteHeader() {
  const { isSignedIn } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 pt-[var(--app-safe-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight">
          <Zap className="h-5 w-5 shrink-0 fill-primary text-primary" />
          <span className="truncate text-foreground">TROLLMAX</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
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

          <div className="flex items-center gap-2 sm:hidden">
            {!isSignedIn && (
              <SignInButton mode="modal">
                <Button size="sm">Get started</Button>
              </SignInButton>
            )}
            {isSignedIn && <AppUserButton />}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border/50 bg-background/95 px-4 py-4 sm:hidden">
          <ul className="space-y-1">
            <li>
              <Link
                href="/pricing"
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Privacy
              </Link>
            </li>
            {isSignedIn ? (
              <li>
                <Link
                  href="/app"
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
              </li>
            ) : (
              <li>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign in
                  </button>
                </SignInButton>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}
