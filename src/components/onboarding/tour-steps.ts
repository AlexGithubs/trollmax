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
    page: null, // shows on any page so guests on form pages see it too
    targetSelector: null,
    title: "Welcome to TROLLMAX! 🎉",
    content:
      "You're about to make some of the most unhinged AI content on the internet. This quick tour will show you everything you can do — from viral brainrot videos to voice-cloned soundboards. Takes about 2 minutes.",
    placement: "center",
  },
  {
    id: "credits-widget",
    page: null,
    targetSelector: '[data-tour="credits-widget"]',
    title: "Banana Credits",
    content:
      "This is your banana credit balance — the currency of TROLLMAX. Every generation costs a small amount. New accounts start with 5 credits, plenty to try everything out.",
    placement: "right",
    spotlightPadding: 8,
  },
  {
    id: "credits-link",
    page: null,
    targetSelector: '[data-tour="credits-link"]',
    title: "Need More Credits?",
    content:
      "Tap here anytime to visit the pricing page and top up your balance with credit packs. Prices are designed to be fair — a little goes a long way.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "nav-video",
    page: null,
    targetSelector: '[data-tour="nav-video"]',
    title: "Brainrot Video Generator",
    content:
      "Create AI talking-head videos with viral backgrounds like Minecraft and Subway Surfers. You write the script, pick a voice, upload a headshot — we handle the rest. Costs 2 banana credits.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "nav-soundboard",
    page: null,
    targetSelector: '[data-tour="nav-soundboard"]',
    title: "Voice Cloning Soundboard",
    content:
      "Clone any voice from a short audio clip and generate a shareable soundboard with custom phrases. Play the clips instantly — great for pranking friends or creating meme content. Costs 1–1.5 banana credits.",
    placement: "right",
    spotlightPadding: 6,
  },
  {
    id: "dashboard-video-card",
    page: null,
    targetSelector: '[data-tour="dashboard-video-card"]',
    title: "Make Your First Video",
    content:
      "The Brainrot Video Generator lets you turn any script into a talking-head video with viral game footage in the background. Perfect for TikTok, Reels, and Shorts. Let's go see how it works!",
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
    content:
      "Give your video a name (for your dashboard only) and write the script the AI will read aloud. You can use up to 2000 characters — the first 500 are included in the base cost, and each additional 500 adds 1 credit.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    id: "video-voice-tabs",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-voice-tabs"]',
    title: "2. Pick a Voice",
    content:
      "Choose from our library of preset AI voices, or use one of your own cloned soundboard voices. Preset voices run through ElevenLabs for maximum quality; soundboard voices can use Replicate F5 for a different style.",
    placement: "bottom",
    spotlightPadding: 6,
  },
  {
    id: "video-preset-grid",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-preset-grid"]',
    title: "Browse Voice Presets",
    content:
      "Tap any card to select a preset and hear a short preview. Tap again to stop. Use the category filters at the top to narrow down the selection. Each preset has its own personality and vibe.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-headshot",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-headshot"]',
    title: "3. Your Talking Head",
    content:
      "Upload a clear front-facing photo — your face becomes the animated talking head in the video. We validate the photo automatically (must have a visible face) and compress it before upload. JPG, PNG, WebP, HEIC all work.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-layout",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-layout"]',
    title: "Choose Your Layout",
    content:
      "Full screen puts your talking head front and center. Top half + background splits the screen — your face on top, a viral game clip on the bottom. The split layout is the classic brainrot formula.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-background",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-background"]',
    title: "4. Background Video",
    content:
      "Pick the background that plays when you're in split-layout mode. Minecraft gameplay keeps viewers hooked with familiar visuals. Subway Surfers is the king of brainrot — fast, colorful, impossible to ignore.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "video-captions",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-captions"]',
    title: "5. Auto Captions",
    content:
      "Enable captions to have your script auto-transcribed and burned into the video using Whisper AI. Captions dramatically boost watch time and accessibility — we recommend leaving them on.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "video-generate-btn",
    page: "/app/video/new",
    targetSelector: '[data-tour="video-generate-btn"]',
    title: "Generate!",
    content:
      "Once everything is filled in, hit Generate. The credit cost is shown right on the button — it updates live as your script length changes. Generation typically takes 1–3 minutes. You'll be redirected to your video when it's done.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-intro",
    page: null,
    targetSelector: null,
    title: "Next Up: Voice Cloning Soundboard",
    content:
      "That's the full video creator. Now let's check out the soundboard — where you clone any voice from a short audio clip and build a set of shareable one-tap phrases.",
    placement: "center",
    navigateTo: "/app/soundboard/new",
    navigateLabel: "Take me to the Soundboard →",
  },

  // ─── Soundboard New steps ─────────────────────────────────────────────────
  {
    id: "sb-voice-source",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-voice-source"]',
    title: "1. Your Voice Source",
    content:
      "Upload your own audio clip (10–20 seconds of clear speech works best), or choose from one of our preset celebrity-style voices. Uploading your own sample gives you a truly unique clone — nobody else has that voice.",
    placement: "bottom",
    spotlightPadding: 8,
  },
  {
    id: "sb-voice-quality",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-voice-quality"]',
    title: "Voice Quality Tier",
    content:
      "Choose between Good (Replicate F5-TTS — fast and solid) or Great (ElevenLabs — premium quality). ElevenLabs sounds more natural and handles emotional range better, but both produce convincing clones.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "sb-phrases",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-phrases"]',
    title: "2. Add Your Phrases",
    content:
      "These are the lines your cloned voice will say — each phrase becomes a playable button on your soundboard. Default phrases are pre-filled for you. Add your own, edit them, or remove any you don't want. Up to 6 phrases at the base rate.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-expansion",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-expansion"]',
    title: "Phrase Expansion",
    content:
      "Need more than 6 phrases, or longer lines? You can expand beyond the base limits for just +0.5 banana credits on top of the base generation cost. Great for building a comprehensive soundboard.",
    placement: "top",
    spotlightPadding: 6,
  },
  {
    id: "sb-ref-transcript",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-ref-transcript"]',
    title: "Reference Transcript (Pro tip)",
    content:
      "If you're uploading your own audio, paste a rough transcript of what the sample says here. This dramatically improves voice similarity — the model uses it to better understand the speaker's rhythm and pronunciation.",
    placement: "top",
    spotlightPadding: 8,
  },
  {
    id: "sb-generate-btn",
    page: "/app/soundboard/new",
    targetSelector: '[data-tour="sb-generate-btn"]',
    title: "Generate the Soundboard!",
    content:
      "Hit Generate and watch the magic happen. Each phrase is cloned in parallel. When done, you'll get a shareable link (like trollmax.io/s/xyz) that anyone can use to play your soundboard — no account needed.",
    placement: "top",
    spotlightPadding: 8,
  },

  // ─── Tour complete ────────────────────────────────────────────────────────
  {
    id: "tour-complete",
    page: null,
    targetSelector: null,
    title: "You're all set! 🎉",
    content:
      "That's the full TROLLMAX experience. Go create something unhinged. You can always restart this tour from the sidebar if you need a refresher — look for the ? button.",
    placement: "center",
    navigateTo: "/app",
    navigateLabel: "Go to Dashboard",
  },
]
