/**
 * ElevenLabs text-to-speech. Preset `voiceId` values are ElevenLabs voice IDs.
 *
 * Env:
 *   ELEVENLABS_API_KEY (required)
 *   ELEVENLABS_API_BASE_URL — optional, default https://api.elevenlabs.io
 *   ELEVENLABS_MODEL_ID — optional, default eleven_turbo_v2_5
 *   ELEVENLABS_OUTPUT_FORMAT — optional, default mp3_44100_128
 */
import { nanoid } from "nanoid"
import type {
  TTSProvider,
  CloneOptions,
  CloneResult,
  SynthesizeOptions,
  SynthesizeResult,
} from "../types"
import { getFileStore } from "@/lib/storage"

const DEFAULT_BASE = "https://api.elevenlabs.io"
const DEFAULT_MODEL = "eleven_turbo_v2_5"
const DEFAULT_OUTPUT = "mp3_44100_128"
const DEFAULT_STABILITY = 0.3
const DEFAULT_SIMILARITY_BOOST = 0.85
const DEFAULT_STYLE = 0
const DEFAULT_USE_SPEAKER_BOOST = true

export class ElevenLabsTTSProvider implements TTSProvider {
  protected readonly apiKey: string
  protected readonly baseUrl: string
  protected readonly modelId: string
  protected readonly outputFormat: string
  protected readonly stability: number
  protected readonly similarityBoost: number
  protected readonly style: number
  protected readonly useSpeakerBoost: boolean

  constructor() {
    const key = process.env.ELEVENLABS_API_KEY?.trim()
    if (!key) {
      throw new Error("ELEVENLABS_API_KEY is required for ElevenLabsTTSProvider")
    }
    this.apiKey = key
    this.baseUrl = (process.env.ELEVENLABS_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "")
    this.modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL
    this.outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || DEFAULT_OUTPUT
    this.stability = parseClampedFloatEnv(
      "ELEVENLABS_VOICE_STABILITY",
      DEFAULT_STABILITY
    )
    this.similarityBoost = parseClampedFloatEnv(
      "ELEVENLABS_VOICE_SIMILARITY_BOOST",
      DEFAULT_SIMILARITY_BOOST
    )
    this.style = parseClampedFloatEnv("ELEVENLABS_VOICE_STYLE", DEFAULT_STYLE)
    this.useSpeakerBoost = parseBooleanEnv(
      "ELEVENLABS_USE_SPEAKER_BOOST",
      DEFAULT_USE_SPEAKER_BOOST
    )
  }

  async clone(_opts: CloneOptions): Promise<CloneResult> {
    throw new Error(
      "ElevenLabs is used only for preset voices. Set REPLICATE_API_TOKEN or MODAL_XTTS_URL so uploaded samples use the zero-shot pipeline."
    )
  }

  async synthesize(opts: SynthesizeOptions): Promise<SynthesizeResult> {
    if (/^https?:\/\//i.test(opts.voiceId.trim())) {
      throw new Error(
        "ElevenLabs preset voices use voice IDs, not reference URLs. Check VOICE_PRESET_* env vars."
      )
    }
    const voiceId = encodeURIComponent(opts.voiceId.trim())
    const q = new URLSearchParams({ output_format: this.outputFormat })
    const url = `${this.baseUrl}/v1/text-to-speech/${voiceId}?${q}`

    const body: Record<string, unknown> = {
      text: opts.text,
      model_id: this.modelId,
      voice_settings: {
        stability: this.stability,
        similarity_boost: this.similarityBoost,
        style: this.style,
        use_speaker_boost: this.useSpeakerBoost,
      },
    }
    if (opts.language?.trim()) {
      body.language_code = opts.language.trim().toLowerCase().slice(0, 5)
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(
        `ElevenLabs TTS failed (${res.status}): ${errText.slice(0, 500)}`
      )
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    const ext = this.outputFormat.startsWith("mp3")
      ? "mp3"
      : this.outputFormat.startsWith("wav")
        ? "wav"
        : "audio"
    const mime =
      ext === "mp3"
        ? "audio/mpeg"
        : ext === "wav"
          ? "audio/wav"
          : "application/octet-stream"

    const fileStore = getFileStore()
    const { url: audioUrl } = await fileStore.upload(
      `clips/${nanoid()}.${ext}`,
      audioBuffer,
      mime
    )

    return {
      audioUrl,
      durationSeconds: estimateMp3DurationSeconds(audioBuffer.length),
    }
  }

  async deleteVoice(_voiceId: string): Promise<void> {
    // Library / preset voices must not be deleted from here; IVC cleanup is optional.
  }
}

/** ~128 kbps MP3 ≈ 16kB/s; keeps duration hints sane for captions/UI. */
function estimateMp3DurationSeconds(bytes: number): number {
  return Math.max(1, Math.round(bytes / 16000))
}

function parseClampedFloatEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

function parseBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase()
  if (!raw) return fallback
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false
  return fallback
}
