"use client"

import Link from "next/link"
import { SignInButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

/** Primary CTA to create + optional sign-in for guests on video/soundboard list pages. */
export function GuestMediaEmptyCtas({
  createHref,
  createLabel,
}: {
  createHref: string
  createLabel: string
}) {
  return (
    <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
      <Button asChild size="sm">
        <Link href={createHref}>{createLabel}</Link>
      </Button>
      <SignInButton mode="modal">
        <Button type="button" size="sm" variant="outline">
          Sign in to save your work
        </Button>
      </SignInButton>
    </div>
  )
}
