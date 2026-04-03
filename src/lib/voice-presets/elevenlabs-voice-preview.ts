/**
 * Preset preview audio via ElevenLabs:
 * 1) GET /v2/voices?voice_ids=… (recommended; richer data for workspace + library voices)
 * 2) Fallback GET /v1/voices/{id}
 * 3) Hosted preview_url / verified_languages preview (CDN fetch)
 * 4) GET /v1/voices/{id}/samples/{sample_id}/audio for each sample
 * 5) Cached POST /v1/text-to-speech/{id} — always works when the voice is usable for TTS
 */

const DEFAULT_MODEL = "eleven_turbo_v2_5"
const DEFAULT_OUTPUT = "mp3_44100_128"
const PREVIEW_LINE =
  "Hi — this is a quick preview so you can hear this voice before you choose it."

const voiceRecordCache = new Map<string, { value: VoiceRecord | null; at: number }>()
const ttsPreviewCache = new Map<
  string,
  { value: { bytes: Buffer; contentType: string }; at: number }
>()

const TTL_VOICE_MS = 1000 * 60 * 60 * 6
const TTL_VOICE_MISS_MS = 1000 * 60 * 2
// Prefer long-lived caching; we also persist to Vercel Blob in the preview route.
const TTL_TTS_MS = 1000 * 60 * 60 * 24 * 365 * 10 // 10 years

function baseUrl(): string {
  return (process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io").replace(
    /\/$/,
    ""
  )
}

function apiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null
}

type VoiceRecord = {
  voice_id?: string
  preview_url?: string
  verified_languages?: Array<{ preview_url?: string }>
  samples?: Array<{ sample_id?: string }>
}

function extractPreviewUrl(data: VoiceRecord): string | null {
  const top = typeof data.preview_url === "string" ? data.preview_url.trim() : ""
  if (top) return top
  for (const vl of data.verified_languages ?? []) {
    const u = typeof vl.preview_url === "string" ? vl.preview_url.trim() : ""
    if (u) return u
  }
  return null
}

/**
 * Resolve voice metadata: v2 list-by-id first, then v1 single voice.
 * @see https://elevenlabs.io/docs/api-reference/voices/search
 * @see https://elevenlabs.io/docs/api-reference/voices/get
 */
async function fetchVoiceRecord(voiceId: string): Promise<VoiceRecord | null> {
  const id = voiceId.trim()
  if (!id) return null

  const hit = voiceRecordCache.get(id)
  if (hit) {
    const ttl = hit.value === null ? TTL_VOICE_MISS_MS : TTL_VOICE_MS
    if (Date.now() - hit.at < ttl) return hit.value
  }

  const key = apiKey()
  if (!key) {
    voiceRecordCache.set(id, { value: null, at: Date.now() })
    return null
  }

  const v2Url = `${baseUrl()}/v2/voices?voice_ids=${encodeURIComponent(id)}&page_size=30`
  const v2Res = await fetch(v2Url, {
    headers: { "xi-api-key": key },
    cache: "no-store",
  })

  if (v2Res.ok) {
    const j = (await v2Res.json()) as {
      voices?: Array<VoiceRecord & { voice_id: string }>
    }
    const list = j.voices ?? []
    const match =
      list.find((v) => v.voice_id === id) ?? (list.length === 1 ? list[0] : undefined)
    if (match) {
      voiceRecordCache.set(id, { value: match, at: Date.now() })
      return match
    }
  }

  const v1Res = await fetch(`${baseUrl()}/v1/voices/${encodeURIComponent(id)}`, {
    headers: { "xi-api-key": key },
    cache: "no-store",
  })

  if (!v1Res.ok) {
    voiceRecordCache.set(id, { value: null, at: Date.now() })
    return null
  }

  const data = (await v1Res.json()) as VoiceRecord
  voiceRecordCache.set(id, { value: data, at: Date.now() })
  return data
}

const CDN_HEADERS = {
  Accept: "*/*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
}

export async function fetchElevenLabsPreviewAudioBytes(
  previewUrl: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const upstream = await fetch(previewUrl, {
    headers: CDN_HEADERS,
    cache: "no-store",
  })
  if (!upstream.ok) return null
  const raw = Buffer.from(await upstream.arrayBuffer())
  if (raw.length === 0) return null
  const contentType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg"
  return { bytes: raw, contentType }
}

async function fetchSampleAudioBytes(
  voiceId: string,
  sampleId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const key = apiKey()
  if (!key) return null

  const res = await fetch(
    `${baseUrl()}/v1/voices/${encodeURIComponent(voiceId.trim())}/samples/${encodeURIComponent(sampleId.trim())}/audio`,
    { headers: { "xi-api-key": key }, cache: "no-store" }
  )
  if (!res.ok) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length === 0) return null
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream"
  return { bytes: raw, contentType }
}

/**
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */
async function fetchPreviewViaTts(
  voiceId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const key = apiKey()
  if (!key) return null

  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || DEFAULT_OUTPUT
  const q = new URLSearchParams({ output_format: outputFormat })
  const url = `${baseUrl()}/v1/text-to-speech/${encodeURIComponent(voiceId.trim())}?${q}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: PREVIEW_LINE,
      model_id: modelId,
    }),
    cache: "no-store",
  })

  if (!res.ok) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length === 0) return null
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg"
  return { bytes: raw, contentType }
}

export async function fetchElevenLabsPreviewAudioForVoice(
  voiceId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const id = voiceId.trim()
  if (!id) return null

  const ttsHit = ttsPreviewCache.get(id)
  if (ttsHit && Date.now() - ttsHit.at < TTL_TTS_MS) {
    return ttsHit.value
  }

  const record = await fetchVoiceRecord(id)

  if (record) {
    const previewUrl = extractPreviewUrl(record)
    if (previewUrl) {
      const fromCdn = await fetchElevenLabsPreviewAudioBytes(previewUrl)
      if (fromCdn) return fromCdn
    }

    for (const s of record.samples ?? []) {
      const sid = typeof s.sample_id === "string" ? s.sample_id.trim() : ""
      if (!sid) continue
      const fromSample = await fetchSampleAudioBytes(id, sid)
      if (fromSample) return fromSample
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[preview-audio] using TTS fallback for voice", id)
  }

  const fromTts = await fetchPreviewViaTts(id)
  if (fromTts) {
    ttsPreviewCache.set(id, { value: fromTts, at: Date.now() })
  }
  return fromTts
}

/** JSON route: hosted preview URL only (no TTS). */
export async function fetchElevenLabsVoicePreviewUrl(
  voiceId: string
): Promise<string | null> {
  const record = await fetchVoiceRecord(voiceId)
  if (!record) return null
  return extractPreviewUrl(record)
}
