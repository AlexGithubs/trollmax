"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { capturePageview } from "@/lib/analytics"

function PostHogPageViewInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const query = searchParams?.toString()
    const url = query ? `${pathname}?${query}` : pathname
    capturePageview(window.origin + url)
  }, [pathname, searchParams])

  return null
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  )
}
