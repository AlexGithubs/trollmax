import { VIDEO_GENERATE_BASE_BANANA_CREDITS } from "./video-generation-cost"

/** Client-safe credit costs (no server/storage imports). */
export const BANANA_CREDIT_COSTS = {
  soundboardGenerate: 1,
  videoGenerate: VIDEO_GENERATE_BASE_BANANA_CREDITS,
  soundboardExpansion: 0.5,
} as const
