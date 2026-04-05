"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Mic2, Video } from "lucide-react"
import { cn } from "@/lib/utils"

function navItemClass(active: boolean) {
  return cn(
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors",
    active
      ? "text-primary"
      : "text-muted-foreground hover:text-foreground"
  )
}

function navIconClass(active: boolean) {
  return cn("h-5 w-5", active && "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.45)]")
}

export function AppMobileBottomNav({ showDashboard }: { showDashboard: boolean }) {
  const pathname = usePathname()
  const path = pathname.replace(/\/$/, "") || "/"

  const dashboardActive = showDashboard && path === "/app"
  const videoActive = path === "/app/video" || path.startsWith("/app/video/")
  const soundboardActive = path === "/app/soundboard" || path.startsWith("/app/soundboard/")

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 lg:hidden">
      {showDashboard && (
        <Link
          href="/app"
          scroll={false}
          className={navItemClass(dashboardActive)}
          aria-current={dashboardActive ? "page" : undefined}
        >
          <LayoutDashboard className={navIconClass(dashboardActive)} aria-hidden />
          <span>Dashboard</span>
        </Link>
      )}
      <Link
        href="/app/video"
        scroll={false}
        data-tour="nav-video"
        className={navItemClass(videoActive)}
        aria-current={videoActive ? "page" : undefined}
      >
        <Video className={navIconClass(videoActive)} aria-hidden />
        <span>Video</span>
      </Link>
      <Link
        href="/app/soundboard"
        scroll={false}
        data-tour="nav-soundboard"
        className={navItemClass(soundboardActive)}
        aria-current={soundboardActive ? "page" : undefined}
      >
        <Mic2 className={navIconClass(soundboardActive)} aria-hidden />
        <span>Soundboard</span>
      </Link>
    </nav>
  )
}
