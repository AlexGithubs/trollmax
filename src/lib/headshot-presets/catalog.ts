/**
 * Preset talking-head images: Wikimedia Commons URLs (HTTPS, allowlisted) fetched via our proxy, or a path
 * under `public/` (starts with `/`) served as a static asset.
 */
export interface HeadshotPreset {
  id: string
  displayName: string
  /** Wikimedia image URL, or `/…` path under `public/` */
  imageUrl: string
}

/** Thumbnail / fetch URL for a preset (proxy for Commons, direct for static). */
export function headshotPresetImageSrc(preset: HeadshotPreset): string {
  if (preset.imageUrl.startsWith("/")) return preset.imageUrl
  return `/api/headshot-preset-proxy?u=${encodeURIComponent(preset.imageUrl)}`
}

export const HEADSHOT_PRESETS: HeadshotPreset[] = [
  {
    id: "donald-trump",
    displayName: "Donald Trump",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/53/Donald_Trump_official_portrait_%28cropped%29.jpg",
  },
  {
    id: "barack-obama",
    displayName: "Barack Obama",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg",
  },
  {
    id: "abraham-lincoln",
    displayName: "Abraham Lincoln",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg",
  },
  {
    id: "george-washington",
    displayName: "George Washington",
    /** Stuart portrait — use 330px thumb; full file is ~18MB and exceeds proxy limits. */
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg/330px-Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg",
  },
  {
    id: "andrew-tate",
    displayName: "Andrew Tate",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a5/Andrew_Tate_-_James_Tamim_Upload_%28Cropped_Wide_Portrait%29.png",
  },
  {
    id: "tristan-tate",
    displayName: "Tristan Tate",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Tristan_Tate_2025.png",
  },
  {
    id: "david-goggins",
    displayName: "David Goggins",
    imageUrl: "/headshots/david-goggins.jpg",
  },
  {
    id: "benjamin-netanyahu",
    displayName: "Benjamin Netanyahu",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/87/Benjamin_Netanyahu%2C_January_2024.jpg",
  },
  {
    id: "vladimir-putin",
    displayName: "Vladimir Putin",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/2c/Vladimir_Putin_delivering_a_speech_at_the_2021_St._Petersburg_International_Economic_Forum_%28cropped%29.jpg",
  },
  {
    id: "kim-jong-un",
    displayName: "Kim Jong Un",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Kim_Jong-un_2019_%28cropped%29.jpg",
  },
  {
    id: "joe-biden",
    displayName: "Joe Biden",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg",
  },
  {
    id: "elon-musk",
    displayName: "Elon Musk",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg",
  },
]
