/**
 * ElevenLabs Instant Voice Clone: POST /v1/voices/add, then same TTS as presets.
 */
import { nanoid } from "nanoid"
import type { CloneOptions, CloneResult } from "../types"
import { ElevenLabsTTSProvider } from "./elevenlabs"
import { downloadBlobBuffer } from "@/lib/storage/blob"

export class ElevenLabsIVCTTSProvider extends ElevenLabsTTSProvider {
  async clone(opts: CloneOptions): Promise<CloneResult> {
    // Use downloadBlobBuffer so private Vercel Blob samples are fetched server-side
    // via the SDK (authenticated) rather than a plain public HTTP fetch.
    const { buffer: buf, contentType: ct } = await downloadBlobBuffer(opts.sampleAudioUrl)
    const ext =
      ct.includes("wav") || ct.includes("wave") ? "wav" : ct.includes("mpeg") ? "mp3" : "mp3"
    const mime = ext === "wav" ? "audio/wav" : "audio/mpeg"

    const form = new FormData()
    form.append("name", opts.speakerName.trim().slice(0, 100) || `voice-${nanoid(6)}`)
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
      const errText = await res.text()
      throw new Error(
        `ElevenLabs voice clone failed (${res.status}): ${errText.slice(0, 500)}`
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
