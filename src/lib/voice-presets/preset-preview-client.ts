/**
 * Browser-only: play preset preview via same-origin audio URL so `play()` can run
 * synchronously inside the click handler (avoids autoplay blocks after await fetch).
 */

import { getVoicePresetVolumeMultiplier } from "./voice-volume"

let globalAudio: HTMLAudioElement | null = null
let playingPresetId: string | null = null
let globalAudioCtx: AudioContext | null = null
let globalSourceNode: MediaElementAudioSourceNode | null = null
let globalGainNode: GainNode | null = null

function detachPresetPreviewAudioElement(el: HTMLAudioElement): void {
  el.onended = null
  el.onerror = null
  el.pause()
  el.removeAttribute("src")
  el.load()
}

export function stopPresetPreview(): void {
  if (globalAudio) {
    detachPresetPreviewAudioElement(globalAudio)
    globalAudio = null
  }
  playingPresetId = null

  if (globalSourceNode) {
    try {
      globalSourceNode.disconnect()
    } catch {
      // ignore
    }
    globalSourceNode = null
  }
  if (globalGainNode) {
    try {
      globalGainNode.disconnect()
    } catch {
      // ignore
    }
    globalGainNode = null
  }
}

function isPlayingPreset(presetId: string): boolean {
  return (
    playingPresetId === presetId &&
    globalAudio !== null &&
    !globalAudio.paused &&
    !globalAudio.ended
  )
}

/**
 * If this preset is already playing, stop. Otherwise stop any other preview and play this one.
 * Must stay synchronous (no await) before `play()` so the browser counts it as user-gesture audio.
 */
export function toggleOrPlayPresetPreview(presetId: string): void {
  if (isPlayingPreset(presetId)) {
    stopPresetPreview()
    return
  }

  stopPresetPreview()

  // Static MP3 files committed to the repo — no API calls, no range-request
  // issues, no iOS Safari quirks. Run `npm run download-previews` to refresh.
  const src = `/voice-presets/previews/${encodeURIComponent(presetId)}.mp3`
  const audio = new Audio(src)
  const multiplier = getVoicePresetVolumeMultiplier(presetId)

  // Always keep the media element audible; let the WebAudio GainNode do the
  // loudness adjustment. If we mute the element, MediaElementAudioSourceNode
  // can output silence and nothing will be heard.
  audio.volume = 1
  audio.muted = false
  audio.preload = "auto"
  globalAudio = audio
  playingPresetId = presetId

  if (multiplier !== 1) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        if (!globalAudioCtx || globalAudioCtx.state === "closed") {
          globalAudioCtx = new AudioCtx()
        }
        const ctx = globalAudioCtx

        if (ctx.state === "running") {
          // Context already running — use WebAudio for full amplification.
          globalSourceNode = ctx.createMediaElementSource(audio)
          globalGainNode = ctx.createGain()
          globalGainNode.gain.value = multiplier
          globalSourceNode.connect(globalGainNode)
          globalGainNode.connect(ctx.destination)
        } else {
          // Context is suspended (common on first iOS interaction).
          // Resume it for future taps, but play natively this time so the
          // audio is never silent. HTMLAudioElement.volume caps at 1.0, so
          // amplification > 1× isn't possible, but audible > silent.
          void ctx.resume().catch(() => {})
          audio.volume = Math.min(1, multiplier)
        }
      }
    } catch {
      // Fallback to native playback if WebAudio fails entirely.
      audio.volume = 1
      audio.muted = false
      if (globalSourceNode) globalSourceNode = null
      if (globalGainNode) globalGainNode = null
    }
  }

  audio.onended = () => {
    // Ignore stale events after switching to another preset (same element is abandoned).
    if (globalAudio !== audio) return
    globalAudio = null
    playingPresetId = null
    globalSourceNode = null
    globalGainNode = null
  }
  audio.onerror = () => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[preset preview] audio error", presetId, audio.error)
    }
    if (globalAudio !== audio) return
    globalAudio = null
    playingPresetId = null
    globalSourceNode = null
    globalGainNode = null
  }
  void audio.play().catch((e) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[preset preview] play() rejected", presetId, e)
    }
    if (globalAudio !== audio) return
    globalAudio = null
    playingPresetId = null
    globalSourceNode = null
    globalGainNode = null
  })
}
