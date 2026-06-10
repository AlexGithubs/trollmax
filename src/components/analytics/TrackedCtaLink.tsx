"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { ANALYTICS_EVENTS, track } from "@/lib/analytics"

type TrackedCtaLinkProps = ComponentProps<typeof Link> & {
  cta: string
}

export function TrackedCtaLink({ cta, href, onClick, ...props }: TrackedCtaLinkProps) {
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        track(ANALYTICS_EVENTS.landingCtaClick, {
          cta,
          href: typeof href === "string" ? href : href?.pathname ?? String(href),
        })
        onClick?.(event)
      }}
    />
  )
}
