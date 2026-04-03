"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink } from "lucide-react"
import Link from "next/link"

export function ShareLinkCopy({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2">
      <Link
        href={shareUrl}
        target="_blank"
        className="flex-1 truncate text-xs text-primary hover:underline flex items-center gap-1"
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        {shareUrl}
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={copy}
        title="Copy share link"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
