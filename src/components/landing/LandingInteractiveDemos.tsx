"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Mic2, Pause, Play, Smartphone, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SOUND_SRC = "/landing/soundboard-demo.mp4"
const SOUND_POSTER = "/landing/soundboard-poster.png"
const VIDEO_SRC = "/landing/video-demo.mp4"
const VIDEO_POSTER = "/landing/video-poster.png"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}

function ShowcaseVideo({
  src,
  poster,
  variant,
  className,
}: {
  src: string
  poster: string
  variant: "soundboard" | "talking-head"
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  /** Starts muted (autoplay-safe). User turns sound on with a click (browser requirement). */
  const [muted, setMuted] = useState(true)
  const reducedMotion = usePrefersReducedMotion()

  const togglePlay = useCallback(() => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      v.muted = muted
      void v.play()
    } else {
      v.pause()
    }
  }, [muted])

  const toggleSound = useCallback(() => {
    const v = ref.current
    if (!v) return
    const next = !muted
    v.muted = next
    setMuted(next)
    if (!next && v.paused) void v.play()
  }, [muted])

  const handleEnter = useCallback(() => {
    if (reducedMotion) return
    if (!window.matchMedia("(min-width: 1024px)").matches) return
    const v = ref.current
    if (!v) return
    v.muted = muted
    void v.play().catch(() => {})
  }, [reducedMotion, muted])

  const handleLeave = useCallback(() => {
    if (reducedMotion) return
    if (!window.matchMedia("(min-width: 1024px)").matches) return
    const v = ref.current
    if (!v) return
    v.pause()
    v.currentTime = 0
    setPlaying(false)
  }, [reducedMotion])

  const isPhone = variant === "talking-head"

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-black ring-1 ring-white/10",
          isPhone ? "rounded-[2rem]" : "rounded-xl"
        )}
      >
        <video
          ref={ref}
          src={src}
          poster={poster}
          className={cn(
            "block w-full",
            isPhone
              ? "aspect-[9/16] scale-[1.2] object-cover object-[center_14%]"
              : "aspect-video object-contain"
          )}
          playsInline
          muted={muted}
          loop
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={() => {
            const v = ref.current
            if (v) setMuted(v.muted)
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent transition-opacity duration-300",
            playing ? "opacity-40" : "opacity-70"
          )}
          aria-hidden
        />
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border border-white/10 bg-background/90 shadow-lg backdrop-blur-md hover:bg-background"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
            <span className="max-sm:hidden">{playing ? "Pause" : "Play"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn(
              "border border-white/10 bg-background/90 shadow-lg backdrop-blur-md hover:bg-background",
              !muted && "border-primary/40 text-primary"
            )}
            onClick={(e) => {
              e.stopPropagation()
              toggleSound()
            }}
            aria-label={muted ? "Turn sound on" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            <span className="max-sm:hidden">{muted ? "Sound on" : "Mute"}</span>
          </Button>
        </div>
      </div>
      {!isPhone && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tap <span className="text-foreground/80">Sound on</span> to hear the clips · hover on
          desktop to preview (muted until you unmute)
        </p>
      )}
      {isPhone && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tap <span className="text-foreground/80">Sound on</span> for audio · hover on desktop
          previews with your current mute setting
        </p>
      )}
    </div>
  )
}

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-2 shadow-2xl shadow-primary/10 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5 px-2 pt-1">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[10px] text-muted-foreground/80">
          trollmax.app · soundboard
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-black">{children}</div>
    </div>
  )
}

function PhoneChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="absolute -inset-1 rounded-[2.35rem] bg-gradient-to-b from-primary/25 via-primary/5 to-transparent blur-md" />
      <div className="relative rounded-[2.25rem] border-[10px] border-zinc-800 bg-zinc-950 p-1 shadow-2xl shadow-black/60 ring-1 ring-white/5">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="overflow-hidden rounded-[1.65rem] bg-black">{children}</div>
      </div>
    </div>
  )
}

export function LandingInteractiveDemos() {
  return (
    <>
      <section
        className="border-t border-border/40 bg-background"
        aria-labelledby="demo-video-heading"
      >
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Smartphone className="size-6" aria-hidden />
              </div>
              <div>
                <h2
                  id="demo-video-heading"
                  className="text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  Brainrot talking-head video
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Script + face + background → 9:16 for Shorts and Reels. Preview is in a phone
                  frame with a tight crop — how it reads in-feed, not a tiny figure in the frame.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <PhoneChrome>
              <ShowcaseVideo src={VIDEO_SRC} poster={VIDEO_POSTER} variant="talking-head" />
            </PhoneChrome>
          </div>

          <div className="mt-8 flex justify-center sm:justify-start">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/app/video">Generate a video</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        className="border-t border-border/40 bg-card/15"
        aria-labelledby="demo-soundboard-heading"
      >
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mic2 className="size-6" aria-hidden />
              </div>
              <div>
                <h2
                  id="demo-soundboard-heading"
                  className="text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  Voice cloning soundboard
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  A grid of one-tap clips — perfect for Discord, iMessage, and jokes that land.
                  Recordings are wide like your actual dashboard so you can see the whole board.
                </p>
              </div>
            </div>
          </div>

          <BrowserChrome>
            <ShowcaseVideo src={SOUND_SRC} poster={SOUND_POSTER} variant="soundboard" />
          </BrowserChrome>

          <Button asChild className="mt-8 w-full sm:w-auto">
            <Link href="/app">Build your soundboard</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
