/**
 * Video generation credits:
 * - First {@link VIDEO_SCRIPT_BASE_CHARS} script characters: {@link VIDEO_GENERATE_BASE_BANANA_CREDITS} credits
 * - Each additional {@link VIDEO_SCRIPT_EXTRA_CHARS_PER_BLOCK} (ceil): +{@link VIDEO_SCRIPT_EXTRA_BLOCK_BANANA_CREDITS} credit
 */
export const MAX_VIDEO_SCRIPT_CHARS = 750

export const VIDEO_SCRIPT_BASE_CHARS = 250

export const VIDEO_SCRIPT_EXTRA_CHARS_PER_BLOCK = 100

export const VIDEO_SCRIPT_EXTRA_BLOCK_BANANA_CREDITS = 0.5

/** Base cost for a video (first block of script). Must match BANANA_CREDIT_COSTS.videoGenerate. */
export const VIDEO_GENERATE_BASE_BANANA_CREDITS = 2

export function videoGenerationCostBananaCredits(scriptCharCount: number): number {
  const n = Math.max(0, Math.min(scriptCharCount, MAX_VIDEO_SCRIPT_CHARS))
  const beyondBase = Math.max(0, n - VIDEO_SCRIPT_BASE_CHARS)
  const extraBlocks =
    beyondBase === 0 ? 0 : Math.ceil(beyondBase / VIDEO_SCRIPT_EXTRA_CHARS_PER_BLOCK)
  return (
    VIDEO_GENERATE_BASE_BANANA_CREDITS +
    extraBlocks * VIDEO_SCRIPT_EXTRA_BLOCK_BANANA_CREDITS
  )
}
