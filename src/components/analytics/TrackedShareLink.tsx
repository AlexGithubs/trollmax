"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { ANALYTICS_EVENTS, track } from "@/lib/analytics"
import type { ShareKind } from "@/components/share/ShareMenu"

type TrackedShareLinkProps = ComponentProps<typeof Link> & {
  kind: ShareKind
  method?: string
}

/** Share link that fires share_clicked (e.g. list page → public /v/ or /s/ URL). */
export function TrackedShareLink({
  kind,
  method = "public_link",
  href,
  onClick,
  children,
  ...props
}: TrackedShareLinkProps) {
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        track(ANALYTICS_EVENTS.shareClicked, {
          kind,
          method,
          href: typeof href === "string" ? href : href.pathname,
        })
        onClick?.(event)
      }}
    >
      {children}
    </Link>
  )
}
