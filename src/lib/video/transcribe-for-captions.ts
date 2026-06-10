import Replicate from "replicate"
import { parseWhisperXWords } from "@/lib/audio/match-phrases"
import type { TranscriptWord } from "@/lib/audio/match-phrases"
import { urlForReplicateModelInput } from "@/lib/replicate/url-for-model-input"

const WHISPER_TIMEOUT_MS = 18_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Word-level transcript for captions. Times out quickly so talking-head generation can run in parallel
 * without blocking the pipeline; caption builder falls back to script + audio duration.
 */
export async function transcribeForCaptions(audioUrl: string): Promise<TranscriptWord[]> {
  if (!process.env.REPLICATE_API_TOKEN) return []

  const whisperPromise = (async (): Promise<TranscriptWord[]> => {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    const whisperFileUrl = await urlForReplicateModelInput(replicate, audioUrl, {
      filenameStem: "whisper_audio",
    })
    const result = await replicate.run(
      "thomasmol/whisper-diarization:1495a9cddc83b2203b0d8d3516e38b80fd1572ebc4bc5700ac1da56a9b3ed886",
      {
        input: {
          file_url: whisperFileUrl,
          language: "en",
        },
      }
    )
    return parseWhisperXWords(result)
  })()

  try {
    const words = await Promise.race([
      whisperPromise,
      sleep(WHISPER_TIMEOUT_MS).then(() => {
        throw new Error("Whisper transcription timed out")
      }),
    ])
    console.log(`[video/generate] Transcription found ${words.length} words`)
    return words
  } catch (err) {
    console.warn("[video/generate] Whisper skipped or failed, using script-timed captions:", err)
    return []
  }
}
