import Link from "next/link"
import { AppMobileBottomNav } from "@/components/layout/AppMobileBottomNav"
import { AppUserButton } from "@/components/layout/AppUserButton"
import { OnboardingTour, TourRestartButton } from "@/components/onboarding/OnboardingTour"
import { SignInBalanceLink, SignInMobileButton, SignInSidebarButton } from "@/components/layout/SignInLink"
import { currentUser } from "@clerk/nextjs/server"
import { Zap, Mic2, Video, LayoutDashboard, Coins } from "lucide-react"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { currencyIconAlt, currencyIconSrc } from "@/lib/billing/currency-display"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const ent = user?.id ? await getUserEntitlements(user.id) : null

  return (
    <div className="min-h-screen">
      {/* Desktop: fixed sidebar — always visible, profile never below the fold */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:h-screen lg:w-56 lg:flex-col lg:border-r lg:border-border/50 lg:bg-card/30">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 px-5 font-bold">
          <Zap className="h-4 w-4 fill-primary text-primary" />
          <span>TROLLMAX</span>
        </div>
        <div data-tour="credits-widget" className="mx-3 mt-3 shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
            Banana credits
          </p>
          {user ? (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-foreground">
                {ent?.bananaCreditsBalance ?? 5}
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
          ) : (
            <>
              <p className="mt-1 text-[11px] text-muted-foreground">
                New accounts start with 5 free banana credits.
              </p>
              <SignInBalanceLink />
            </>
          )}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {user && <NavLink href="/app" icon={LayoutDashboard} label="Dashboard" />}
          <NavLink
            href="/app/video"
            icon={Video} label="Video" cost="2" tourId="nav-video"
          />
          <NavLink
            href="/app/soundboard"
            icon={Mic2} label="Soundboard" cost="1" tourId="nav-soundboard"
          />
        </nav>
        <div className="shrink-0 space-y-2 border-t border-border/50 bg-card/30 p-4">
          <TourRestartButton />
          <SignInSidebarButton />
          <AppUserButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-56">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/95 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold">
            <Zap className="h-4 w-4 shrink-0 fill-primary text-primary" />
            <span className="truncate">TROLLMAX</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <Link
                data-tour="credits-widget"
                href="/pricing"
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                {ent?.bananaCreditsBalance ?? 5}
                <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-6 w-6 object-contain" />
              </Link>
            ) : (
              <SignInMobileButton />
            )}
            <AppUserButton />
          </div>
        </header>

        <main className="flex-1 overscroll-y-contain p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      <AppMobileBottomNav showDashboard={Boolean(user)} />

      <OnboardingTour />
    </div>
  )
}

function NavLink({
  href,
  icon: Icon,
  label,
  cost,
  disabled,
  tourId,
}: {
  href: string
  icon: React.ElementType
  label: string
  cost?: string
  disabled?: boolean
  tourId?: string
}) {
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/50">
        <Icon className="h-4 w-4" />
        {label}
        <span className="ml-auto text-xs opacity-60">Soon</span>
      </span>
    )
  }
  return (
    <Link
      href={href}
      data-tour={tourId}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="min-w-0 flex-1">{label}</span>
      {cost ? (
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {cost}
          <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-5 w-5 object-contain" />
        </span>
      ) : null}
    </Link>
  )
}
