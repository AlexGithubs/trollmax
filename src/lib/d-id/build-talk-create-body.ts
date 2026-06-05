/**
 * Build the D-ID POST /talks request body.
 *
 * Kept intentionally minimal — only `result_format` is set in config.
 * Plan-gated parameters (sharpen, motion_factor, fluent, driver_url) are
 * omitted: sending them on the basic tier causes D-ID to accept the job but
 * never process it (status stays "created" indefinitely).
 */
export function buildDidTalkCreateBody(input: {
  sourceUrl: string
  audioUrl: string
  title: string
}): Record<string, unknown> {
  return {
    source_url: input.sourceUrl,
    script: {
      type: "audio",
      audio_url: input.audioUrl,
      subtitles: false,
    },
    name: input.title,
    config: { result_format: "mp4" },
  }
}
