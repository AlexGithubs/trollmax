import { BANANA_CREDIT_COSTS } from "./credit-costs"

export function estimateVideosFromCredits(credits: number): number {
  if (credits <= 0) return 0
  return Math.floor(credits / BANANA_CREDIT_COSTS.videoGenerate)
}

export function estimateSoundboardsFromCredits(credits: number): number {
  if (credits <= 0) return 0
  return Math.floor(credits / BANANA_CREDIT_COSTS.soundboardGenerate)
}

export function formatPackOutputLine(credits: number): string {
  const videos = estimateVideosFromCredits(credits)
  const soundboards = estimateSoundboardsFromCredits(credits)
  return `~${videos} videos or ~${soundboards} soundboards`
}
