"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
  product: "video" | "soundboard"
  manifestId: string
  /** When set, show a button that navigates away without cancelling server-side generation. */
  onLeave?: () => void
}

export function GenerationCloseHint({ product, manifestId, onLeave }: Props) {
  const progressHref =
    product === "video" ? `/app/video/${manifestId}` : `/app/soundboard/${manifestId}`
  const noun = product === "video" ? "video" : "soundboard"

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
      <p className="text-balance">
        You can leave this page — your {noun} will keep generating. Check progress anytime from
        your dashboard.
      </p>
      {onLeave ? (
        <Button type="button" variant="outline" size="sm" onClick={onLeave}>
          View progress
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={progressHref}>View progress</Link>
        </Button>
      )}
    </div>
  )
}
