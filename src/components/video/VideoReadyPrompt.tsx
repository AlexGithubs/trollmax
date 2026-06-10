"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Video, X } from "lucide-react"
import {
  acknowledgeVideoReady,
  readActiveGeneratingVideoId,
} from "@/lib/client/active-generation"

type UnseenVideo = { id: string; title: string }

export function VideoReadyPrompt() {
  const { isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [video, setVideo] = useState<UnseenVideo | null>(null)
  const dismissedRef = useRef<Set<string>>(new Set())

  const checkForReady = useCallback(async () => {
    if (!isSignedIn) return

    try {
      const res = await fetch("/api/video/unseen-ready", { method: "GET" })
      if (!res.ok) return
      const data = (await res.json()) as { videos?: UnseenVideo[] }
      const next = data.videos?.[0]
      if (!next || dismissedRef.current.has(next.id)) return

      const activeId = readActiveGeneratingVideoId()
      if (activeId === next.id) return

      if (pathname === `/app/video/${next.id}`) {
        void acknowledgeVideoReady(next.id)
        return
      }

      setVideo(next)
    } catch {
      // non-fatal
    }
  }, [isSignedIn, pathname])

  useEffect(() => {
    void checkForReady()
  }, [checkForReady])

  useEffect(() => {
    if (!isSignedIn) return

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkForReady()
    }
    document.addEventListener("visibilitychange", onVisible)
    const interval = window.setInterval(() => void checkForReady(), 15000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(interval)
    }
  }, [isSignedIn, checkForReady])

  const dismiss = (videoId: string) => {
    dismissedRef.current.add(videoId)
    setVideo(null)
    void acknowledgeVideoReady(videoId)
  }

  const watchNow = (videoId: string) => {
    dismissedRef.current.add(videoId)
    setVideo(null)
    void acknowledgeVideoReady(videoId)
    router.push(`/app/video/${videoId}`)
  }

  if (!video) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-ready-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-2xl">
        <button
          type="button"
          onClick={() => dismiss(video.id)}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Video className="h-7 w-7 text-primary" />
        </div>
        <h2 id="video-ready-title" className="text-xl font-bold tracking-tight">
          Your video is ready
        </h2>
        <p className="mt-2 text-sm text-muted-foreground text-balance">
          <span className="font-medium text-foreground">{video.title}</span> finished generating.
          Watch it now or find it anytime in your video list.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button className="w-full" onClick={() => watchNow(video.id)}>
            Watch now
          </Button>
          <Button variant="outline" className="w-full" onClick={() => dismiss(video.id)}>
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  )
}
