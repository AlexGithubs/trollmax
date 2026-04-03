/**
 * Video generation: base banana credits cover the first {@link VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK}
 * script characters; each additional 500 (ceil) adds 1 banana credit.
 */
export const VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK = 500

/** Base cost for a video (first block of script). Must match BANANA_CREDIT_COSTS.videoGenerate. */
export const VIDEO_GENERATE_BASE_BANANA_CREDITS = 2

export function videoGenerationCostBananaCredits(scriptCharCount: number): number {
  const n = Math.max(0, scriptCharCount)
  const beyondFirstBlock = Math.max(0, n - VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK)
  const extraBlocks =
    beyondFirstBlock === 0 ? 0 : Math.ceil(beyondFirstBlock / VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK)
  return VIDEO_GENERATE_BASE_BANANA_CREDITS + extraBlocks
}
