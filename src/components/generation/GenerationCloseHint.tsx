"use client"

import { Button } from "@/components/ui/button"

type Props = {
  product: "video" | "soundboard"
  /** When set, shows an explicit "leave" action that navigates away without cancelling generation. */
  onLeave?: () => void
}

/**
 * Reassurance shown on the generation screen. The screen itself is the live progress
 * view, so this offers a single, clearly-labelled way to *leave* (not a redundant
 * "view progress" button) — generation continues server-side either way.
 */
export function GenerationCloseHint({ product, onLeave }: Props) {
  const noun = product === "video" ? "video" : "soundboard"

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-center text-xs text-muted-foreground">
      <p className="text-balance">
        Your {noun} keeps generating even if you leave — it&apos;ll be waiting in your dashboard
        when it&apos;s done.
      </p>
      {onLeave ? (
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onLeave}>
          Leave &amp; check later
        </Button>
      ) : null}
    </div>
  )
}
