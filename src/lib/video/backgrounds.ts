export type BackgroundClip = {
  variant: string
  previewSrc: string
}

export type BackgroundCategory = {
  id: string
  label: string
  description: string
  color: string
  thumbSrc: string
  clips: BackgroundClip[]
}

const CLIP_VARIANTS = ["1", "2", "3", "4"] as const

function clipsForCategory(categoryId: string): BackgroundClip[] {
  return CLIP_VARIANTS.map((variant) => ({
    variant,
    previewSrc: `/video-backgrounds/previews/${categoryId}/${variant}.mp4`,
  }))
}

export const BACKGROUND_CATALOG: BackgroundCategory[] = [
  {
    id: "minecraft",
    label: "Minecraft",
    color: "#2d5a1b",
    thumbSrc: "/video-backgrounds/minecraft-thumb.svg",
    description: "Minecraft parkour gameplay",
    clips: clipsForCategory("minecraft"),
  },
  {
    id: "subway-surfers",
    label: "Subway Surfers",
    color: "#e8721a",
    thumbSrc: "/video-backgrounds/subway-surfers-thumb.svg",
    description: "Subway Surfers gameplay",
    clips: clipsForCategory("subway-surfers"),
  },
  {
    id: "gta-ramp",
    label: "GTA Ramp",
    color: "#3d5a80",
    thumbSrc: "/video-backgrounds/gta-ramp-thumb.svg",
    description: "GTA car ramp jumps & obstacle runs",
    clips: clipsForCategory("gta-ramp"),
  },
  {
    id: "satisfying",
    label: "Satisfying",
    color: "#9b59b6",
    thumbSrc: "/video-backgrounds/satisfying-thumb.svg",
    description: "Slime squish & soap cutting ASMR",
    clips: clipsForCategory("satisfying"),
  },
  {
    id: "roblox",
    label: "Roblox",
    color: "#e74c3c",
    thumbSrc: "/video-backgrounds/roblox-thumb.svg",
    description: "Roblox parkour & obby gameplay",
    clips: clipsForCategory("roblox"),
  },
]

/** Flat list for UI pickers — backward compatible export name. */
export const BACKGROUND_OPTIONS = BACKGROUND_CATALOG.map(
  ({ id, label, color, thumbSrc, description }) => ({
    id,
    label,
    color,
    thumbSrc,
    description,
  })
)

const CATALOG_BY_ID = new Map(BACKGROUND_CATALOG.map((c) => [c.id, c]))

/** Deterministic index from seed string (video manifest id). */
function clipIndexFromSeed(seed: string, clipCount: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % clipCount
}

export function getCategory(categoryId: string): BackgroundCategory | undefined {
  return CATALOG_BY_ID.get(categoryId)
}

export function getClipVariant(
  categoryId: string,
  seed?: string
): string {
  const category = CATALOG_BY_ID.get(categoryId) ?? CATALOG_BY_ID.get("minecraft")!
  const clips = category.clips
  if (!clips.length) return "1"
  if (!seed) {
    return clips[Math.floor(Math.random() * clips.length)]!.variant
  }
  return clips[clipIndexFromSeed(seed, clips.length)]!.variant
}

/**
 * Modal asset token for compose. Format: asset:{category}:{variant}
 * Seed (video id) picks a stable variant per video.
 */
export function getBackgroundAsset(
  backgroundVideoId: string,
  seed?: string
): string {
  if (backgroundVideoId === "none") return ""
  const category = CATALOG_BY_ID.get(backgroundVideoId)
  if (!category) {
    const variant = getClipVariant("minecraft", seed)
    return `asset:minecraft:${variant}`
  }
  const variant = getClipVariant(category.id, seed)
  return `asset:${category.id}:${variant}`
}

export function getPreviewSrc(
  categoryId: string,
  variant?: string
): string | null {
  const category = CATALOG_BY_ID.get(categoryId)
  if (!category?.clips.length) return null
  const v = variant ?? category.clips[0]!.variant
  const clip = category.clips.find((c) => c.variant === v) ?? category.clips[0]
  return clip?.previewSrc ?? null
}

/** Next variant for shuffle in preview overlay. */
export function getNextPreviewVariant(
  categoryId: string,
  currentVariant: string
): string {
  const category = CATALOG_BY_ID.get(categoryId)
  if (!category?.clips.length) return "1"
  const idx = category.clips.findIndex((c) => c.variant === currentVariant)
  const next = idx < 0 ? 0 : (idx + 1) % category.clips.length
  return category.clips[next]!.variant
}

export function getBackgroundLabel(backgroundVideoId: string): string {
  if (backgroundVideoId === "none") return "None"
  return (
    BACKGROUND_CATALOG.find((b) => b.id === backgroundVideoId)?.label ??
    backgroundVideoId
  )
}

/** Human-readable background for forms and generation inputs. */
export function formatBackgroundForDisplay(
  talkingMode: "full" | "half" | undefined,
  backgroundVideoId: string
): string {
  if (talkingMode !== "half") return "None"
  return getBackgroundLabel(backgroundVideoId)
}

/** Short subtitle under video titles in lists and detail headers. */
export function formatVideoListSubtitle(video: {
  talkingMode?: "full" | "half"
  backgroundVideoId: string
}): string {
  if (video.talkingMode !== "half") return "Full screen"
  return getBackgroundLabel(video.backgroundVideoId)
}

/** Value to persist on the manifest when creating a video. */
export function backgroundVideoIdForManifest(
  talkingMode: "full" | "half",
  backgroundVideoId: string
): string {
  return talkingMode === "half" ? backgroundVideoId : "none"
}
