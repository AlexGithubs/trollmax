"use client"

import { useRef, useState } from "react"
import type { SoundClip } from "@/lib/manifests/types"
import { getVoicePresetVolumeMultiplier } from "@/lib/voice-presets/voice-volume"

interface Props {
  clips: SoundClip[]
  voicePresetId?: string
}

export function SoundboardPlayer({ clips, voicePresetId }: Props) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)

  function play(clip: SoundClip) {
    setErrorId(null)

    if (playing === clip.id) {
      audioRef.current?.pause()
      // Ensure we fully detach nodes when stopping to avoid stale graphs.
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = null
      }
      setPlaying(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(clip.audioUrl)
    audioRef.current = audio
    setPlaying(clip.id)

    const multiplier = getVoicePresetVolumeMultiplier(voicePresetId)

    // Apply per-voice gain. HTMLAudio.volume is clamped to [0..1], so we
    // use Web Audio for gain > 1.
    try {
      // If multiplier is 1, avoid WebAudio to prevent AudioContext overhead.
      if (multiplier === 1) {
        void 0
      } else {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) throw new Error("Web Audio API not supported")

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      // AudioContext must be resumed in response to user gestures.
      void ctx.resume().catch(() => {})

      // Clean up old nodes.
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = null
      }

      // Keep the element audible; let WebAudio GainNode apply loudness.
      audio.volume = 1
      audio.muted = false

      sourceNodeRef.current = ctx.createMediaElementSource(audio)
      gainNodeRef.current = ctx.createGain()
      gainNodeRef.current.gain.value = multiplier

      sourceNodeRef.current.connect(gainNodeRef.current)
      gainNodeRef.current.connect(ctx.destination)
      }
    } catch {
      // If WebAudio fails, fall back to regular playback volume.
    }

    audio
      .play()
      .catch(() => {
        setPlaying(null)
        setErrorId(clip.id)
      })
    audio.onended = () => setPlaying(null)
    audio.onerror = () => { setPlaying(null); setErrorId(clip.id) }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {clips.map((clip) => {
        const isPlaying = playing === clip.id
        return (
          <button
            key={clip.id}
            onClick={() => play(clip)}
            className={[
              "group relative flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-4 text-center text-sm font-medium transition-all",
              isPlaying
                ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_16px_-4px] shadow-primary/40"
                : errorId === clip.id
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border/60 bg-card/50 text-muted-foreground hover:border-primary/30 hover:bg-secondary/50 hover:text-foreground",
            ].join(" ")}
          >
            {/* Waveform indicator */}
            <span className="flex h-5 items-end gap-[3px]">
              {[3, 5, 4, 6, 3].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h * 3}px` }}
                  className={[
                    "w-[3px] rounded-full transition-all",
                    isPlaying
                      ? `bg-primary animate-pulse`
                      : "bg-current opacity-40 group-hover:opacity-70",
                  ].join(" ")}
                />
              ))}
            </span>
            <span className="line-clamp-2 leading-tight">{clip.label}</span>
            {isPlaying && (
              <span className="absolute bottom-1.5 right-2 text-[10px] text-primary opacity-70">
                ▶ playing
              </span>
            )}
            {errorId === clip.id && !isPlaying && (
              <span className="absolute bottom-1.5 right-2 text-[10px] text-destructive opacity-70">
                ✕ failed
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
