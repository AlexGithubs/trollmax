/**
 * Client-side audio preprocessing for voice cloning.
 * Trims leading/trailing silence, mixes to mono, resamples to 22050 Hz,
 * and re-encodes as 16-bit PCM WAV — the format F5-TTS expects.
 *
 * All processing happens in the browser via Web Audio API. Zero extra API calls.
 */

const SILENCE_THRESHOLD = 0.01 // ~-40 dBFS
const PAD_SAMPLES = 1102 // 50 ms at 22050 Hz
const TARGET_SAMPLE_RATE = 22050
const MIN_DURATION_S = 6

export async function trimAndEncodeAudio(file: File): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })

    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    } finally {
      ctx.close()
    }

    // Mix to mono
    const mono = mixToMono(audioBuffer)
    const sr = audioBuffer.sampleRate // should be TARGET_SAMPLE_RATE

    // Find silence boundaries
    let start = 0
    while (start < mono.length && Math.abs(mono[start]) <= SILENCE_THRESHOLD) start++
    let end = mono.length - 1
    while (end > start && Math.abs(mono[end]) <= SILENCE_THRESHOLD) end--

    // Add padding
    start = Math.max(0, start - PAD_SAMPLES)
    end = Math.min(mono.length - 1, end + PAD_SAMPLES)

    const trimmed = mono.slice(start, end + 1)
    const durationS = trimmed.length / sr

    console.log(
      `[trim] ${(mono.length / sr).toFixed(2)}s → ${durationS.toFixed(2)}s` +
        ` (removed ${((mono.length - trimmed.length) / sr).toFixed(2)}s of silence)`
    )

    if (durationS < MIN_DURATION_S) {
      throw new Error(
        `After trimming silence, your clip is only ${durationS.toFixed(1)}s. ` +
          `Please record a longer clip (minimum 6 seconds of speech).`
      )
    }

    return encodeWav(trimmed, sr)
  } catch (err) {
    // If it's our validation error, rethrow so the UI can surface it
    if (err instanceof Error && err.message.startsWith("After trimming")) throw err
    // For decode errors (unsupported codec, corrupt file, etc.), fall back to original
    console.warn("[trim] Could not process audio, uploading original:", err)
    return file
  }
}

function mixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0)
  const len = buf.length
  const out = new Float32Array(len)
  const n = buf.numberOfChannels
  for (let ch = 0; ch < n; ch++) {
    const ch_data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) out[i] += ch_data[i]
  }
  for (let i = 0; i < len; i++) out[i] /= n
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length
  const dataBytes = numSamples * 2 // 16-bit = 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  // RIFF chunk
  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataBytes, true)
  writeString(view, 8, "WAVE")

  // fmt subchunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)       // subchunk size
  view.setUint16(20, 1, true)        // PCM
  view.setUint16(22, 1, true)        // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byteRate
  view.setUint16(32, 2, true)        // blockAlign
  view.setUint16(34, 16, true)       // bitsPerSample

  // data subchunk
  writeString(view, 36, "data")
  view.setUint32(40, dataBytes, true)

  // PCM samples — clamp float32 → int16
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
