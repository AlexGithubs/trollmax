"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  pollUntilGenerationSettled,
  startGenerationPost,
} from "@/lib/client/wait-for-generation"

type Props = {
  soundboardId: string
  className?: string
}

export function RegenerateSoundboardButton({ soundboardId, className }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function handleRegenerate() {
    if (busy) return
    setBusy(true)
    setError("")

    try {
      const { promise, getPostError, clearPostError } = startGenerationPost(
        `/api/soundboard/${soundboardId}/generate`
      )

      const result = await pollUntilGenerationSettled({
        statusUrl: `/api/soundboard/${soundboardId}/status`,
        generatePromise: promise,
        getPostError,
        clearPostError,
        onProgress: () => {},
      })

      if (result.outcome === "insufficient_credits") {
        setError("Not enough credits to regenerate. Buy credits from the pricing page.")
        return
      }
      if (result.outcome === "failed") {
        setError(result.status.lastError ?? "Generation failed")
        return
      }
      if (result.outcome === "timeout") {
        setError("Still generating — check back in a minute or refresh this page.")
        return
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start generation")
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={className}>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-primary underline"
        disabled={busy}
        onClick={() => void handleRegenerate()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          "Regenerate"
        )}
      </Button>
      {error ? <span className="mt-2 block text-xs text-destructive">{error}</span> : null}
    </span>
  )
}
