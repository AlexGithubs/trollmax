/**
 * Matches soundboard phrases against a WhisperX word-level transcript.
 * Uses a sliding window of normalized tokens — no external dependencies.
 */

export interface TranscriptWord {
  word: string
  start: number // seconds
  end: number   // seconds
}

export interface PhraseMatch {
  phrase: string
  startSec: number
  endSec: number
}

/**
 * Parses word-level timestamps from a Replicate transcription output.
 * Handles thomasmol/whisper-diarization (segments[].words[]) and
 * legacy WhisperX (word_segments[] flat array).
 */
export function parseWhisperXWords(result: unknown): TranscriptWord[] {
  if (!result || typeof result !== "object") return []
  const r = result as Record<string, unknown>

  // WhisperX returns word_segments at top level when align_output=true
  if (Array.isArray(r.word_segments)) {
    return r.word_segments
      .filter((w): w is { word: string; start: number; end: number } =>
        typeof w === "object" && w !== null &&
        typeof (w as Record<string, unknown>).word === "string" &&
        typeof (w as Record<string, unknown>).start === "number" &&
        typeof (w as Record<string, unknown>).end === "number"
      )
      .map((w) => ({ word: w.word, start: w.start, end: w.end }))
  }

  // Fallback: segments[].words[]
  if (Array.isArray(r.segments)) {
    const words: TranscriptWord[] = []
    for (const seg of r.segments) {
      const s = seg as Record<string, unknown>
      if (Array.isArray(s.words)) {
        for (const w of s.words) {
          const wd = w as Record<string, unknown>
          if (typeof wd.word === "string" && typeof wd.start === "number" && typeof wd.end === "number") {
            words.push({ word: wd.word as string, start: wd.start as number, end: wd.end as number })
          }
        }
      }
    }
    if (words.length > 0) return words
  }

  return []
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Returns the first occurrence of the phrase in the transcript, or null.
 * Exact normalized token match (case-insensitive, punctuation-stripped).
 */
export function matchPhrase(
  phrase: string,
  words: TranscriptWord[]
): PhraseMatch | null {
  const phraseTokens = normalize(phrase)
  if (phraseTokens.length === 0 || words.length === 0) return null

  const wordTokens = words.map((w) => normalize(w.word)[0] ?? "")

  for (let i = 0; i <= wordTokens.length - phraseTokens.length; i++) {
    let match = true
    for (let j = 0; j < phraseTokens.length; j++) {
      if (wordTokens[i + j] !== phraseTokens[j]) {
        match = false
        break
      }
    }
    if (match) {
      return {
        phrase,
        startSec: words[i].start,
        endSec: words[i + phraseTokens.length - 1].end,
      }
    }
  }

  return null
}
