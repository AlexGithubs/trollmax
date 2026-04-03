import type { TranscriptWord } from "@/lib/audio/match-phrases"
import type { Caption } from "@/lib/manifests/types"

/**
 * Builds Caption[] from word-level transcript data.
 * Falls back to sentence splitting over 30s if no words are available.
 */
export function buildCaptions(words: TranscriptWord[], fallbackScript: string): Caption[] {
  const scriptWords = fallbackScript
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)

  // Prefer script text for caption content so captions match exactly what user wrote.
  if (scriptWords.length > 0) {
    const chunkSize = 4
    const chunks: string[] = []
    for (let i = 0; i < scriptWords.length; i += chunkSize) {
      chunks.push(scriptWords.slice(i, i + chunkSize).join(" "))
    }

    // Use transcript end-time when available; otherwise use a sane fixed fallback.
    const totalMs =
      words.length > 0
        ? Math.max(1000, Math.round(words[words.length - 1]!.end * 1000))
        : 30000

    const totalChunkWords = chunks.reduce(
      (sum, c) => sum + c.split(/\s+/).filter(Boolean).length,
      0
    )
    if (totalChunkWords <= 0) return []

    let cursorMs = 0
    return chunks.map((text, i) => {
      const n = text.split(/\s+/).filter(Boolean).length
      const remainingMs = totalMs - cursorMs
      const remainingChunks = chunks.length - i
      const ideal = Math.round((n / totalChunkWords) * totalMs)
      const spanMs = i === chunks.length - 1 ? remainingMs : Math.max(300, Math.min(ideal, remainingMs - (remainingChunks - 1) * 200))
      const startMs = cursorMs
      const endMs = Math.min(totalMs, startMs + spanMs)
      cursorMs = endMs
      return { startMs, endMs, text }
    })
  }

  // Last-resort fallback when script is empty: use transcript chunks if available.
  if (words.length > 0) {
    const captions: Caption[] = []
    const chunkSize = 4
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      captions.push({
        startMs: Math.round(chunk[0].start * 1000),
        endMs: Math.round(chunk[chunk.length - 1].end * 1000),
        text: chunk.map((w) => w.word).join(" "),
      })
    }
    return captions
  }

  return []
}
