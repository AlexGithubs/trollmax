import { downloadBlobBuffer } from "@/lib/storage/blob"

/** D-ID docs: uploaded audio must not exceed 6MB. */
const DID_AUDIO_MAX_BYTES = 6 * 1024 * 1024

/**
 * D-ID `POST /talks` with `script.type: "audio"` validates `audio_url` and rejects Vercel private
 * blob signed URLs (`*.private.blob.vercel-storage.com/...?download=1`). Upload bytes to
 * `POST /audios` and use the returned temporary URL instead.
 */
export async function didAudioUrlFromBlobUrl(
  audioUrl: string,
  didAuthHeader: string
): Promise<string> {
  const { buffer, contentType } = await downloadBlobBuffer(audioUrl)
  if (buffer.length > DID_AUDIO_MAX_BYTES) {
    const mb = Math.round((buffer.length / 1024 / 1024) * 10) / 10
    throw new Error(
      `Narration audio is about ${mb}MB; D-ID accepts up to 6MB per upload. Try a shorter script.`
    )
  }

  const ct = contentType || "audio/mpeg"
  const ext = ct.includes("wav") ? "wav" : ct.includes("webm") ? "webm" : "mp3"

  const form = new FormData()
  form.append(
    "audio",
    new Blob([new Uint8Array(buffer)], { type: ct }),
    `narration.${ext}`
  )

  const res = await fetch("https://api.d-id.com/audios", {
    method: "POST",
    headers: { Authorization: didAuthHeader },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `D-ID audio upload failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
    )
  }

  const json = (await res.json()) as { url?: string }
  if (!json.url?.trim()) {
    throw new Error("D-ID audio upload: missing url in response")
  }
  return json.url.trim()
}
