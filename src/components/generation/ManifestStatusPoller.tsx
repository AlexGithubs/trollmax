"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type Props = {
  product: "video" | "soundboard"
  manifestId: string
  initialStatus: "processing" | "failed"
  initialProgressStep?: string | null
  initialLastError?: string | null
}

type PollStatus = {
  status?: string
  progressStep?: string | null
  progressPct?: number | null
  progressDetail?: string | null
  lastError?: string | null
}

export function ManifestStatusPoller({
  product,
  manifestId,
  initialStatus,
  initialProgressStep,
  initialLastError,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [progressStep, setProgressStep] = useState(initialProgressStep ?? null)
  const [progressPct, setProgressPct] = useState<number | null>(null)
  const [progressDetail, setProgressDetail] = useState<string | null>(null)
  const [lastError, setLastError] = useState(initialLastError ?? null)

  useEffect(() => {
    if (status !== "processing") return

    let cancelled = false
    const statusUrl =
      product === "video"
        ? `/api/video/${manifestId}/status`
        : `/api/soundboard/${manifestId}/status`

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(statusUrl, { method: "GET" })
          const json = (await res.json().catch(() => null)) as PollStatus | null
          if (json) {
            setProgressStep(json.progressStep ?? null)
            setProgressPct(typeof json.progressPct === "number" ? json.progressPct : null)
            setProgressDetail(json.progressDetail ?? null)
            if (json.lastError) setLastError(json.lastError)

            if (json.status === "complete") {
              router.refresh()
              return
            }
            if (json.status === "failed") {
              setStatus("failed")
              router.refresh()
              return
            }
          }
        } catch {
          // Transient network errors — keep polling.
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [manifestId, product, router, status])

  if (status === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">
          {progressStep || "Your content is being generated…"}
        </p>
        {typeof progressPct === "number" ? (
          <p className="text-xs text-muted-foreground">{progressPct}% complete</p>
        ) : null}
        {progressDetail ? (
          <p className="text-xs text-muted-foreground">{progressDetail}</p>
        ) : null}
        <p className="text-xs text-muted-foreground text-balance">
          You can leave this page — it keeps generating in the background. This page updates
          automatically.
        </p>
      </div>
    )
  }

  if (status === "failed") {
    const retryHref = product === "video" ? "/app/video/new" : `/app/soundboard/${manifestId}`
    const retryLabel = product === "video" ? "Try again" : "Retry generation"

    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">Generation failed</p>
        <p className="text-xs text-muted-foreground">
          {lastError ?? "Something went wrong. Try again in a few minutes."}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href={retryHref}>{retryLabel}</Link>
        </Button>
      </div>
    )
  }

  return null
}
