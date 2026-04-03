/**
 * ElevenLabs Instant Voice Clone: POST /v1/voices/add, then same TTS as presets.
 */
import { nanoid } from "nanoid"
import type { CloneOptions, CloneResult } from "../types"
import { ElevenLabsTTSProvider } from "./elevenlabs"
import { downloadBlobBuffer } from "@/lib/storage/blob"

/**
 * ElevenLabs only accepts alphanumeric characters, spaces, hyphens, underscores,
 * and dots in voice names. Anything else (apostrophes, emoji, etc.) causes a 422
 * "string did not match pattern" Pydantic validation error.
 */
function sanitizeVoiceName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9 \-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
  return cleaned || `voice-${nanoid(6)}`
}

/**
 * Map a stored content-type to the { ext, mime } pair ElevenLabs actually accepts.
 * ElevenLabs IVC supports: mp3, wav, ogg, flac, m4a (aac in mp4 container).
 * Sending the wrong MIME type causes their format validator to fail.
 */
function resolveAudioFormat(contentType: string): { ext: string; mime: string } {
  const ct = contentType.toLowerCase()
  if (ct.includes("wav") || ct.includes("wave")) return { ext: "wav", mime: "audio/wav" }
  if (ct.includes("ogg") || ct.includes("opus")) return { ext: "ogg", mime: "audio/ogg" }
  if (ct.includes("flac")) return { ext: "flac", mime: "audio/flac" }
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac"))
    return { ext: "m4a", mime: "audio/mp4" }
  // audio/mpeg, audio/mp3, or anything unrecognised → treat as mp3
  return { ext: "mp3", mime: "audio/mpeg" }
}

export class ElevenLabsIVCTTSProvider extends ElevenLabsTTSProvider {
  async clone(opts: CloneOptions): Promise<CloneResult> {
    // Use downloadBlobBuffer so private Vercel Blob samples are fetched server-side
    // via the SDK (authenticated) rather than a plain public HTTP fetch.
    const { buffer: buf, contentType: ct } = await downloadBlobBuffer(opts.sampleAudioUrl)
    const { ext, mime } = resolveAudioFormat(ct)

    const form = new FormData()
    form.append("name", sanitizeVoiceName(opts.speakerName))
    form.append(
      "files",
      new Blob([new Uint8Array(buf)], { type: mime }),
      `sample.${ext}`
    )

    const res = await fetch(`${this.baseUrl}/v1/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: form,
    })

    if (!res.ok) {
      let detail = ""
      try {
        const j = (await res.json()) as { detail?: unknown }
        if (typeof j.detail === "string") detail = j.detail
        else if (Array.isArray(j.detail)) detail = j.detail.map((d: { msg?: string }) => d.msg ?? "").join("; ")
        else detail = JSON.stringify(j.detail ?? j)
      } catch {
        detail = await res.text().catch(() => "")
      }
      const hint =
        res.status === 422
          ? " Check that the audio file is a valid MP3, WAV, OGG, FLAC, or M4A, and the voice name contains only letters, numbers, spaces, and basic punctuation."
          : ""
      throw new Error(
        `Voice cloning failed (${res.status}): ${detail.slice(0, 300)}${hint}`
      )
    }

    const json = (await res.json()) as { voice_id?: string }
    const voiceId = json.voice_id?.trim()
    if (!voiceId) {
      throw new Error("ElevenLabs voice clone: missing voice_id in response")
    }

    return { voiceId }
  }

  async deleteVoice(voiceId: string): Promise<void> {
    const id = voiceId.trim()
    if (!id || /^https?:\/\//i.test(id)) return

    const res = await fetch(`${this.baseUrl}/v1/voices/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "xi-api-key": this.apiKey },
    })
    if (!res.ok && res.status !== 404) {
      const t = await res.text().catch(() => "")
      console.warn(`[ElevenLabsIVC] delete voice ${id}: ${res.status} ${t.slice(0, 200)}`)
    }
  }
}
