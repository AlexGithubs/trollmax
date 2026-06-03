/**
 * Preset talking-head images shipped under `public/headshots/`.
 * Generic stock-style fictional characters — not public figures or celebrities.
 */
export interface HeadshotPreset {
  id: string
  displayName: string
  tagline: string
  /** Path under `public/`, e.g. `/headshots/news-reporter.jpg` */
  imageUrl: string
}

/** URL for `<img src>` and for `fetch()` when applying a preset (same-origin static file). */
export function headshotPresetImageSrc(preset: HeadshotPreset): string {
  return preset.imageUrl
}

export const HEADSHOT_PRESETS: HeadshotPreset[] = [
  {
    id: "news-reporter",
    displayName: "News Reporter",
    tagline: "We go live to the chaos",
    imageUrl: "/headshots/news-reporter.jpg",
  },
  {
    id: "tiktok-star",
    displayName: "TikTok Star",
    tagline: "POV: this goes viral",
    imageUrl: "/headshots/tiktok-star.jpg",
  },
  {
    id: "podcast-bro",
    displayName: "Podcast Bro",
    tagline: "Hot take, mic hot",
    imageUrl: "/headshots/podcast-bro.jpg",
  },
  {
    id: "crypto-degen",
    displayName: "Crypto Degen",
    tagline: "WAGMI (probably not)",
    imageUrl: "/headshots/crypto-degen.jpg",
  },
  {
    id: "sigma-guy",
    displayName: "Sigma Guy",
    tagline: "What color is your Bugatti",
    imageUrl: "/headshots/sigma-guy.jpg",
  },
  {
    id: "karen",
    displayName: "Karen",
    tagline: "I'd like to speak to the manager",
    imageUrl: "/headshots/karen.jpg",
  },
  {
    id: "npc-gamer",
    displayName: "NPC Gamer",
    tagline: "Touch grass? Never heard of it",
    imageUrl: "/headshots/npc-gamer.jpg",
  },
  {
    id: "street-interviewer",
    displayName: "Street Interviewer",
    tagline: "Quick question for you",
    imageUrl: "/headshots/street-interviewer.jpg",
  },
  {
    id: "that-girl",
    displayName: "That Girl",
    tagline: "5am routine, no notes",
    imageUrl: "/headshots/that-girl.jpg",
  },
  {
    id: "conspiracy-uncle",
    displayName: "Conspiracy Uncle",
    tagline: "Do your own research",
    imageUrl: "/headshots/conspiracy-uncle.jpg",
  },
  {
    id: "drill-sergeant",
    displayName: "Drill Sergeant",
    tagline: "DROP AND GIVE ME TWENTY",
    imageUrl: "/headshots/drill-sergeant.jpg",
  },
  {
    id: "delulu-bestie",
    displayName: "Delulu Bestie",
    tagline: "Manifesting a W",
    imageUrl: "/headshots/delulu-bestie.jpg",
  },
  {
    id: "linkedin-lunatic",
    displayName: "LinkedIn Lunatic",
    tagline: "Agree?",
    imageUrl: "/headshots/linkedin-lunatic.jpg",
  },
  {
    id: "rizz-king",
    displayName: "Rizz King",
    tagline: "No cap, you're cooked",
    imageUrl: "/headshots/rizz-king.jpg",
  },
  {
    id: "boomer-dad",
    displayName: "Boomer Dad",
    tagline: "How do I open PDF",
    imageUrl: "/headshots/boomer-dad.jpg",
  },
  {
    id: "brainrot-kid",
    displayName: "Brainrot Kid",
    tagline: "Skibidi ong fr fr",
    imageUrl: "/headshots/brainrot-kid.jpg",
  },
]
