import type { TranscriptWord } from "@/lib/audio/match-phrases"
import type { Caption } from "@/lib/manifests/types"

/** Max words per on-screen caption (one line at a time). */
const MAX_WORDS_PER_CHUNK = 2
/** Character cap per caption line before starting the next one. */
const MAX_CHARS_PER_CHUNK = 16

function splitScriptIntoChunks(scriptWords: string[]): string[] {
  const chunks: string[] = []
  let current: string[] = []

  const flush = () => {
    if (current.length === 0) return
    chunks.push(current.join(" "))
    current = []
  }

  for (const word of scriptWords) {
    const next = [...current, word]
    const nextText = next.join(" ")
    const overWordLimit = next.length > MAX_WORDS_PER_CHUNK
    const overCharLimit = nextText.length > MAX_CHARS_PER_CHUNK

    if (current.length > 0 && (overWordLimit || overCharLimit)) {
      flush()
      current = [word]
    } else {
      current = next
    }
  }

  flush()
  return chunks
}

function timeChunksFromTranscript(
  chunks: string[],
  scriptWordCount: number,
  words: TranscriptWord[],
  totalMs: number
): Caption[] {
  let scriptCursor = 0

  const toTranscriptIdx = (scriptIdx: number) =>
    Math.min(
      words.length - 1,
      Math.max(0, Math.floor((scriptIdx / scriptWordCount) * words.length))
    )

  return chunks.map((text, i) => {
    const chunkWordCount = text.split(/\s+/).filter(Boolean).length
    const chunkStartIdx = scriptCursor
    const chunkEndIdx = scriptCursor + chunkWordCount - 1
    scriptCursor += chunkWordCount

    const startWord = words[toTranscriptIdx(chunkStartIdx)]!
    const endWord = words[toTranscriptIdx(chunkEndIdx)]!
    const startMs = Math.round(startWord.start * 1000)
    let endMs =
      i === chunks.length - 1
        ? Math.max(Math.round(endWord.end * 1000), totalMs)
        : Math.max(Math.round(endWord.end * 1000), startMs + 350)

    return { startMs, endMs, text }
  })
}

function timeChunksEvenly(chunks: string[], totalMs: number): Caption[] {
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
    const spanMs =
      i === chunks.length - 1
        ? remainingMs
        : Math.max(350, Math.min(ideal, remainingMs - (remainingChunks - 1) * 200))
    const startMs = cursorMs
    const endMs = Math.min(totalMs, startMs + spanMs)
    cursorMs = endMs
    return { startMs, endMs, text }
  })
}

function normalizeCaptionWindows(captions: Caption[], totalMs: number): Caption[] {
  for (let i = 0; i < captions.length; i++) {
    const cap = captions[i]!
    if (i > 0 && cap.startMs < captions[i - 1]!.endMs) {
      cap.startMs = captions[i - 1]!.endMs
    }
    if (cap.endMs <= cap.startMs) {
      cap.endMs = Math.min(totalMs, cap.startMs + 350)
    }
  }
  return captions
}

/**
 * Builds Caption[] from word-level transcript data.
 * Falls back to script chunks timed across `audioDurationMs` (or 30s) when no words are available.
 */
export function buildCaptions(
  words: TranscriptWord[],
  fallbackScript: string,
  audioDurationMs?: number
): Caption[] {
  const scriptWords = fallbackScript
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)

  // Prefer script text for caption content so captions match exactly what user wrote.
  if (scriptWords.length > 0) {
    const chunks = splitScriptIntoChunks(scriptWords)
    if (chunks.length === 0) return []

    const totalMs =
      words.length > 0
        ? Math.max(1000, Math.round(words[words.length - 1]!.end * 1000))
        : Math.max(1000, audioDurationMs ?? 30000)

    const timed =
      words.length > 0
        ? timeChunksFromTranscript(chunks, scriptWords.length, words, totalMs)
        : timeChunksEvenly(chunks, totalMs)

    return normalizeCaptionWindows(timed, totalMs)
  }

  // Last-resort fallback when script is empty: use transcript chunks if available.
  if (words.length > 0) {
    const captions: Caption[] = []
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_CHUNK) {
      const chunk = words.slice(i, i + MAX_WORDS_PER_CHUNK)
      captions.push({
        startMs: Math.round(chunk[0]!.start * 1000),
        endMs: Math.round(chunk[chunk.length - 1]!.end * 1000),
        text: chunk.map((w) => w.word).join(" "),
      })
    }
    return captions
  }

  return []
}
