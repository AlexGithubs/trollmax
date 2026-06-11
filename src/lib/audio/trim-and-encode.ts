/**
 * Client-side audio preprocessing for voice cloning.
 * Trims leading/trailing silence, mixes to mono, resamples to 22050 Hz,
 * and re-encodes as 16-bit PCM WAV for voice upload (22050 Hz mono).
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

    // Decode at the platform's native rate. We must NOT pass a custom sampleRate to
    // the AudioContext constructor — iOS Safari throws on that, which previously sent
    // the whole flow into the "upload the raw file" fallback (a huge video over
    // mobile). Resampling to TARGET_SAMPLE_RATE happens separately via OfflineAudioContext.
    const decoded = await decodeAudioFile(arrayBuffer)

    // Downmix to mono + resample to TARGET_SAMPLE_RATE in one offline render.
    const mono = await resampleToMono(decoded, TARGET_SAMPLE_RATE)
    const sr = TARGET_SAMPLE_RATE

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

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error("Web Audio is not supported in this browser.")
  return Ctor
}

/** Decode using a default-rate context (max cross-browser/iOS compatibility). */
async function decodeAudioFile(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctor = getAudioContextCtor()
  const ctx = new Ctor()
  try {
    // Some Safari versions only support the callback form of decodeAudioData.
    return await new Promise<AudioBuffer>((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(
        arrayBuffer,
        (buf) => resolve(buf),
        (err) => reject(err ?? new Error("decodeAudioData failed"))
      ) as unknown as Promise<AudioBuffer> | undefined
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve, reject)
      }
    })
  } finally {
    void ctx.close()
  }
}

/** Downmix to mono and resample to targetRate via an offline render. */
async function resampleToMono(
  buf: AudioBuffer,
  targetRate: number
): Promise<Float32Array> {
  const OfflineCtor =
    (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext

  // No OfflineAudioContext (extremely old browser): bail so the caller uploads the
  // original file and the server extracts/normalizes the audio instead of us emitting
  // a wrong-sample-rate WAV.
  if (!OfflineCtor) throw new Error("OfflineAudioContext unavailable")

  const frames = Math.max(1, Math.ceil(buf.duration * targetRate))
  const offline = new OfflineCtor(1, frames, targetRate)
  const source = offline.createBufferSource()
  source.buffer = buf
  source.connect(offline.destination) // multi-channel → mono destination auto-downmixes
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
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
