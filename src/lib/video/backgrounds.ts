export const BACKGROUND_OPTIONS = [
  {
    id: "minecraft",
    label: "Minecraft",
    color: "#2d5a1b",
    description: "Forest green gameplay",
  },
  {
    id: "subway-surfers",
    label: "Subway Surfers",
    color: "#e8721a",
    description: "Orange runner background",
  },
] as const

const BACKGROUNDS: Record<string, string> = {
  minecraft: "asset:minecraft",
  "subway-surfers": "asset:subway-surfers",
}

export function getBackgroundAsset(backgroundVideoId: string): string {
  if (backgroundVideoId === "none") return ""
  return BACKGROUNDS[backgroundVideoId] ?? "asset:minecraft"
}

export function getBackgroundLabel(backgroundVideoId: string): string {
  if (backgroundVideoId === "none") return "None"
  return (
    BACKGROUND_OPTIONS.find((b) => b.id === backgroundVideoId)?.label ?? backgroundVideoId
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
