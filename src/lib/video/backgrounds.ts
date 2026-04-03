const BACKGROUNDS: Record<string, string> = {
  minecraft: "asset:minecraft",
  "subway-surfers": "asset:subway-surfers",
}

export function getBackgroundAsset(backgroundVideoId: string): string {
  return BACKGROUNDS[backgroundVideoId] ?? "asset:minecraft"
}
