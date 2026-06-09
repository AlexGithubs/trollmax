export type TourPlacement = "top" | "bottom" | "left" | "right" | "center"

export interface TourStep {
  id: string
  /** Pathname this step belongs to. null = any page (used for transition/welcome steps). */
  page: string | null
  /** CSS selector using data-tour attribute, e.g. '[data-tour="credits"]'. null = center modal. */
  targetSelector: string | null
  title: string
  content: string
  placement: TourPlacement
  /** If set, show a navigation CTA button that routes to this href. */
  navigateTo?: string
  navigateLabel?: string
  /** Extra padding around the spotlight cutout in px */
  spotlightPadding?: number
}

export const TOUR_STEPS: TourStep[] = [
  // ─── Dashboard steps ──────────────────────────────────────────────────────
  {
    id: "welcome",
    page: null,
    targetSelector: null,
    title: "Welcome to TROLLMAX! 🎉",
    content: "Make unhinged AI content — brainrot videos, voice clones, soundboards. This quick tour shows you everything.",
    placement: "center",
  },
  {
    id: "credits-widget",
    page: null,
    targetSelector: '[data-tour="credits-widget"]',
    title: "Banana Credits",
    content: "Your balance — the currency of TROLLMAX. Every generation costs a few credits. New accounts start with 5.",
    placement: "right",
    spotlightPadding: 8,
  },
  {
    id: "credits-link",
    page: null,
    targetSelector: '[data-tour="credits-link"]',
    title: "Top Up Anytime",
    content: "Tap to visit the pricing page and buy more credits. A little goes a long way.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "nav-video",
    page: null,
    targetSelector: '[data-tour="nav-video"]',
    title: "Brainrot Video",
    content: "Script + face + voice → AI talking-head video with viral game footage. Costs 2 credits.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "nav-soundboard",
    page: null,
    targetSelector: '[data-tour="nav-soundboard"]',
    title: "Voice Soundboard",
    content: "Clone any voice and build a shareable one-tap soundboard. Great for pranks and memes. Costs 1–1.5 credits.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "dashboard-video-card",
    page: "/app",
    targetSelector: '[data-tour="dashboard-video-card"]',
    title: "Make Your First Video",
    content: "Turn any script into a talking-head video — perfect for TikTok, Reels, and Shorts.",
    placement: "bottom",
    spotlightPadding: 8,
    navigateTo: "/app/video/new",
    navigateLabel: "Explore the video creator →",
  },

  // ─── Video New steps ──────────────────────────────────────────────────────
  {
    id: "video-headshot",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-headshot"]',
    title: "Step 1 — Who's talking?",
    content:
      "Pick a preset portrait or upload your own front-facing photo. Then choose a voice below before continuing.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-voice-tabs",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-voice-tabs"]',
    title: "Pick a voice",
    content:
      "Preset AI voices are fastest. Use a cloned soundboard or upload your own sample — tap Continue when both headshot and voice are set.",
    placement: "bottom",
    spotlightPadding: 6,
  },
  {
    id: "video-preset-grid",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-preset-grid"]',
    title: "Browse voice presets",
    content: "Tap a card to select and preview. Tap again to stop. Use the filters to browse by category.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-script",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-script"]',
    title: "Step 2 — Script",
    content:
      "Name your video, pick a template chip to get started, then edit the script. Up to 2000 chars.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    id: "video-layout",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-layout"]',
    title: "Step 3 — Video layout",
    content:
      "Pick full screen (face only) or split screen (face on top, gameplay clip below). Each option shows a mini preview of the frame.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-background",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-background"]',
    title: "Background",
    content:
      "The clip that plays behind you in split-layout mode. Minecraft and Subway Surfers are the go-to brainrot picks.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-captions",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-captions"]',
    title: "Captions",
    content:
      "Optional — turn on to auto-transcribe your script and burn single-line captions timed to your narration.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-generate-btn",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-generate-btn"]',
    title: "Generate!",
    content:
      "Acknowledge consent, then hit Generate. You'll sign in first if needed. Takes 1–3 min, then you're redirected to your video.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-intro",
    page: null,
    targetSelector: null,
    title: "Next: Voice Soundboard",
    content: "That's the video creator. Now let's look at the soundboard — clone any voice and build shareable one-tap phrases.",
    placement: "center",
    navigateTo: "/app/soundboard/new",
    navigateLabel: "Take me to the Soundboard →",
  },

  // ─── Soundboard New steps ─────────────────────────────────────────────────
  {
    id: "sb-voice-source",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-voice-source"]',
    title: "1. Voice Source",
    content: "Upload 10–20 sec of clear audio to clone, or pick a preset. Your own clip = a voice nobody else has.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    id: "sb-voice-quality",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-voice-quality"]',
    title: "Quality Tier",
    content: "Good = Replicate F5 (fast). Great = ElevenLabs (premium). Both produce convincing clones.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "sb-phrases",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-phrases"]',
    title: "2. Phrases",
    content: "Each phrase becomes a playable button on your soundboard. Edit, remove, or add up to 6 at base rate.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-expansion",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-expansion"]',
    title: "More Phrases",
    content: "Need more than 6 or longer lines? Expand for just +0.5 credits.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "sb-ref-transcript",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-ref-transcript"]',
    title: "Reference Transcript",
    content: "Paste what your audio sample says. Dramatically improves voice similarity — highly recommended.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-generate-btn",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-generate-btn"]',
    title: "Generate!",
    content: "Hit Generate — phrases clone in parallel. You'll get a shareable link (trollmax.io/s/xyz) anyone can play.",
    placement: "top",
    spotlightPadding: 8,
  },

  // ─── Tour complete ────────────────────────────────────────────────────────
  {
    id: "tour-complete",
    page: null,
    targetSelector: null,
    title: "You're all set!",
    content:
      "That's the full TROLLMAX experience. Go create something unhinged — we'll bring you back to where you left off if you started mid-flow.",
    placement: "center",
    navigateTo: "/app",
    navigateLabel: "Go to Dashboard",
  },
]

export type TourSegmentKind = "full" | "video" | "soundboard"

export type TourMode = "full" | "contextual"

export interface TourRuntimeState {
  active: boolean
  step: number
  mode?: TourMode
  segmentStart?: number
  segmentEnd?: number
}

function tourStepIndex(id: string): number {
  return TOUR_STEPS.findIndex((s) => s.id === id)
}

export function tourSegmentBounds(kind: TourSegmentKind): { start: number; end: number } {
  switch (kind) {
    case "video":
      return {
        start: tourStepIndex("video-headshot"),
        end: tourStepIndex("video-generate-btn"),
      }
    case "soundboard":
      return {
        start: tourStepIndex("sb-voice-source"),
        end: tourStepIndex("sb-generate-btn"),
      }
    case "full":
    default:
      return { start: 0, end: TOUR_STEPS.length - 1 }
  }
}

export function tourSegmentKindForPath(pathname: string): TourSegmentKind {
  if (pathname.startsWith("/app/video/new")) return "video"
  if (pathname.startsWith("/app/soundboard/new")) return "soundboard"
  return "full"
}

export function canOfferPageTour(pathname: string): boolean {
  const kind = tourSegmentKindForPath(pathname)
  return kind === "video" || kind === "soundboard"
}

export function pageTourStepCount(pathname: string): number {
  const kind = tourSegmentKindForPath(pathname)
  const { start, end } = tourSegmentBounds(kind)
  return end - start + 1
}

export function resolveTourMode(state: TourRuntimeState): TourMode {
  if (state.mode) return state.mode
  const full = tourSegmentBounds("full")
  if (state.segmentStart === full.start && state.segmentEnd === full.end) return "full"
  return "contextual"
}

export function tourModeLabel(mode: TourMode, pathname: string): string {
  if (mode === "full") return "Full app tour"
  if (pathname.startsWith("/app/video/new")) return "Video creator tour"
  if (pathname.startsWith("/app/soundboard/new")) return "Soundboard tour"
  return "Page tour"
}

export function createFullTourState(): TourRuntimeState {
  const { start, end } = tourSegmentBounds("full")
  return {
    active: true,
    step: start,
    mode: "full",
    segmentStart: start,
    segmentEnd: end,
  }
}

export function tourStartStepForVideoWizard(wizardStep: 1 | 2 | 3): number {
  const id =
    wizardStep === 2 ? "video-script" : wizardStep === 3 ? "video-layout" : "video-headshot"
  return tourStepIndex(id)
}

/** Contextual tour: on create pages, only tour that flow — not dashboard / other products. */
export function createContextualTourState(
  pathname: string,
  options?: { wizardStep?: 1 | 2 | 3 }
): TourRuntimeState {
  const kind = tourSegmentKindForPath(pathname)
  const { start, end } = tourSegmentBounds(kind)
  let step = start

  if (kind === "video" && options?.wizardStep) {
    const suggested = tourStartStepForVideoWizard(options.wizardStep)
    if (suggested >= start && suggested <= end) step = suggested
  }

  return { active: true, step, mode: "contextual", segmentStart: start, segmentEnd: end }
}

export function tourDisplayStep(state: TourRuntimeState): {
  current: number
  total: number
  isFirst: boolean
  isLast: boolean
} {
  const start = state.segmentStart ?? 0
  const end = state.segmentEnd ?? TOUR_STEPS.length - 1
  return {
    current: state.step - start + 1,
    total: end - start + 1,
    isFirst: state.step <= start,
    isLast: state.step >= end,
  }
}
