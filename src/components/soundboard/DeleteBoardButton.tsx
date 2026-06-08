"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"

interface Props {
  id: string
  shareUrl?: string
  redirectTo?: string
  variant?: "full" | "icon"
}

export function DeleteBoardButton({ id, redirectTo, variant = "full" }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      await fetch(`/api/soundboard/${id}`, { method: "DELETE" })
    } finally {
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    }
  }

  return (
    <Button
      variant={variant === "icon" ? (confirming ? "destructive" : "outline") : "ghost"}
      size={variant === "icon" ? "icon" : "sm"}
      className={[
        variant === "icon"
          ? "h-11 w-11 shrink-0"
          : "w-full text-xs",
        variant !== "icon" && confirming
          ? "text-destructive border border-destructive/30 bg-destructive/5"
          : variant !== "icon"
            ? "text-muted-foreground"
            : "",
      ].join(" ")}
      onClick={handleDelete}
      disabled={deleting}
      aria-label={confirming ? "Confirm delete soundboard" : "Delete soundboard"}
      title={confirming ? "Confirm delete" : "Delete soundboard"}
    >
      {deleting ? (
        <Loader2 className={variant === "icon" ? "h-4 w-4 animate-spin" : "mr-1.5 h-3.5 w-3.5 animate-spin"} />
      ) : (
        <Trash2 className={variant === "icon" ? "h-4 w-4" : "mr-1.5 h-3.5 w-3.5"} />
      )}
      {variant === "full" ? (confirming ? "Confirm delete" : "Delete soundboard") : null}
    </Button>
  )
}
