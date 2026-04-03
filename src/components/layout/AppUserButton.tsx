"use client"

import { UserButton } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"

/** Reuses the same appearance object as `ClerkProvider` so the menu is always dark. */
export function AppUserButton() {
  return <UserButton appearance={clerkAppearance} />
}
