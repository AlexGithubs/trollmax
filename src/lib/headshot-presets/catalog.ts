/**
 * Preset talking-head images shipped under `public/headshots/` (no runtime fetch from Wikimedia).
 * You are responsible for rights / consent for how you use generated output.
 */
export interface HeadshotPreset {
  id: string
  displayName: string
  /** Path under `public/`, e.g. `/headshots/foo.jpg` */
  imageUrl: string
}

/** URL for `<img src>` and for `fetch()` when applying a preset (same-origin static file). */
export function headshotPresetImageSrc(preset: HeadshotPreset): string {
  return preset.imageUrl
}

export const HEADSHOT_PRESETS: HeadshotPreset[] = [
  {
    id: "donald-trump",
    displayName: "Donald Trump",
    imageUrl: "/headshots/donald-trump.jpg",
  },
  {
    id: "barack-obama",
    displayName: "Barack Obama",
    imageUrl: "/headshots/barack-obama.jpg",
  },
  {
    id: "abraham-lincoln",
    displayName: "Abraham Lincoln",
    imageUrl: "/headshots/abraham-lincoln.jpg",
  },
  {
    id: "george-washington",
    displayName: "George Washington",
    imageUrl: "/headshots/george-washington.jpg",
  },
  {
    id: "andrew-tate",
    displayName: "Andrew Tate",
    imageUrl: "/headshots/andrew-tate.png",
  },
  {
    id: "tristan-tate",
    displayName: "Tristan Tate",
    imageUrl: "/headshots/tristan-tate.png",
  },
  {
    id: "david-goggins",
    displayName: "David Goggins",
    imageUrl: "/headshots/david-goggins.jpg",
  },
  {
    id: "benjamin-netanyahu",
    displayName: "Benjamin Netanyahu",
    imageUrl: "/headshots/benjamin-netanyahu.jpg",
  },
  {
    id: "vladimir-putin",
    displayName: "Vladimir Putin",
    imageUrl: "/headshots/vladimir-putin.jpg",
  },
  {
    id: "kim-jong-un",
    displayName: "Kim Jong Un",
    imageUrl: "/headshots/kim-jong-un.jpg",
  },
  {
    id: "joe-biden",
    displayName: "Joe Biden",
    imageUrl: "/headshots/joe-biden.jpg",
  },
  {
    id: "elon-musk",
    displayName: "Elon Musk",
    imageUrl: "/headshots/elon-musk.jpg",
  },
]
