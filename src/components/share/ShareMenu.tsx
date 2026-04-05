"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { shareMessageWithUrl } from "@/lib/share-messages"
import {
  Share2,
  Copy,
  Check,
  MessageSquare,
  Mail,
  Instagram,
  ExternalLink,
  ChevronDown,
  Twitter,
} from "lucide-react"
import { cn } from "@/lib/utils"

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function openIntent(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

export type ShareKind = "video" | "soundboard"

const PRIVACY: Record<ShareKind, string> = {
  video: "Anyone with this link can watch this video.",
  soundboard: "Anyone with this link can play this soundboard.",
}

export function ShareMenu({
  shareUrl,
  kind,
  className,
}: {
  shareUrl: string
  kind: ShareKind
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<"link" | "message" | "instagram" | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const fullMessage = shareMessageWithUrl(shareUrl)
  const privacyNote = PRIVACY[kind]

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const onCopy = useCallback(
    async (which: "link" | "message" | "instagram", text: string) => {
      setFeedback(null)
      const ok = await copyToClipboard(text)
      if (ok) {
        setCopied(which)
        setTimeout(() => setCopied(null), 2000)
        return
      }
      window.prompt("Copy this text:", text)
      setFeedback("Copy blocked by your browser — select the text above.")
    },
    []
  )

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"

  const nativeShare = useCallback(async () => {
    setFeedback(null)
    try {
      await navigator.share({
        title: "Trollmax",
        text: fullMessage,
        url: shareUrl,
      })
      setOpen(false)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setFeedback("Sharing isn’t available here — try Copy link or an app below.")
    }
  }, [fullMessage, shareUrl])

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedMessage = encodeURIComponent(fullMessage)

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setOpen((v) => !v)
          setFeedback(null)
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Share2 className="h-4 w-4" />
        Share
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>

      {open && (
        <div
          className="absolute right-0 z-[100] mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-border/60 bg-popover p-3 shadow-lg"
          role="menu"
        >
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{privacyNote}</p>

          {feedback && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{feedback}</p>
          )}

          <div className="flex flex-col gap-1">
            {canNativeShare && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 justify-start gap-2 font-normal"
                onClick={() => void nativeShare()}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
                Share via system…
                <span className="ml-auto text-[10px] text-muted-foreground">Messages</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() => void onCopy("message", fullMessage)}
            >
              {copied === "message" ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 shrink-0 opacity-80" />
              )}
              Copy message + link
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() => void onCopy("link", shareUrl)}
            >
              {copied === "link" ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 shrink-0 opacity-80" />
              )}
              Copy link only
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() => void onCopy("instagram", fullMessage)}
              title="Instagram has no web share URL — paste into DMs or Stories."
            >
              {copied === "instagram" ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Instagram className="h-4 w-4 shrink-0 opacity-80" />
              )}
              Copy for Instagram
            </Button>

            <div className="my-1 border-t border-border/40" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(
                  `https://twitter.com/intent/tweet?text=${encodedMessage}`
                )
              }
            >
              <Twitter className="h-4 w-4 shrink-0 opacity-80" />
              Post on X
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
                )
              }
            >
              <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
              Facebook
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(`https://wa.me/?text=${encodedMessage}`)
              }
            >
              <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
              WhatsApp
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(`sms:?body=${encodedMessage}`)
              }
            >
              <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
              Messages (SMS)
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(
                  `mailto:?subject=${encodeURIComponent("Check this out on Trollmax")}&body=${encodedMessage}`
                )
              }
            >
              <Mail className="h-4 w-4 shrink-0 opacity-80" />
              Email
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 font-normal"
              onClick={() =>
                openIntent(
                  `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent("Check out what I made on Trollmax")}`
                )
              }
            >
              <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
              Reddit
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
