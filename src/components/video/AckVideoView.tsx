"use client"

import { useEffect } from "react"
import { acknowledgeVideoReady } from "@/lib/client/active-generation"

export function AckVideoView({ videoId }: { videoId: string }) {
  useEffect(() => {
    void acknowledgeVideoReady(videoId)
  }, [videoId])

  return null
}
