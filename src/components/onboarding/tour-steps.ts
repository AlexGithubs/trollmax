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
    page: null,
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
    id: "video-script",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-script"]',
    title: "1. Name & Script",
    content: "Name your video and write the script the AI reads aloud. Up to 2000 chars — first 500 included, +1 credit per extra 500.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    id: "video-voice-tabs",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-voice-tabs"]',
    title: "2. Pick a Voice",
    content: "Choose a preset AI voice, use a cloned soundboard voice, or upload your own audio sample. Presets are fastest; uploading takes a couple extra minutes.",
    placement: "bottom",
    spotlightPadding: 6,
  },
  {
    id: "video-preset-grid",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-preset-grid"]',
    title: "Browse Voice Presets",
    content: "Tap a card to select and preview. Tap again to stop. Use the filters to browse by category.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-headshot",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-headshot"]',
    title: "3. Talking Head Photo",
    content: "Upload a front-facing photo — your face becomes the animated talking head. JPG, PNG, WebP, HEIC all work.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-layout",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-layout"]',
    title: "Layout",
    content: "Full screen = face only. Top half + background = face on top, viral game clip below — the classic brainrot look.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-background",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-background"]',
    title: "4. Background",
    content: "The clip that plays behind you in split-layout mode. Minecraft and Subway Surfers are the go-to brainrot picks.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-captions",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-captions"]',
    title: "5. Captions",
    content: "Auto-transcribes your script and burns captions in. Boosts watch time significantly — leave it on.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-generate-btn",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-generate-btn"]',
    title: "Generate!",
    content: "Hit Generate when everything's set. Credit cost updates live. Takes 1–3 min, then you're redirected to your video.",
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
    title: "You're all set! 🎉",
    content: "That's the full TROLLMAX experience. Go create something unhinged. Restart this tour anytime from the sidebar.",
    placement: "center",
    navigateTo: "/app",
    navigateLabel: "Go to Dashboard",
  },
]
