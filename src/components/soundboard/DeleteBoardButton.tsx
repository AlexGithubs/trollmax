"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"

interface Props {
  id: string
  shareUrl?: string
  redirectTo?: string
}

export function DeleteBoardButton({ id, redirectTo }: Props) {
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
      variant="ghost"
      size="sm"
      className={[
        "w-full text-xs",
        confirming ? "text-destructive border border-destructive/30 bg-destructive/5" : "text-muted-foreground",
      ].join(" ")}
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      )}
      {confirming ? "Confirm delete" : "Delete soundboard"}
    </Button>
  )
}
