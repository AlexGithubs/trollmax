import Link from "next/link"
import { Zap } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-primary fill-primary" />
            <span>TROLLMAX</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/takedown" className="hover:text-foreground transition-colors">
              DMCA / Takedown
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TROLLMAX. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
