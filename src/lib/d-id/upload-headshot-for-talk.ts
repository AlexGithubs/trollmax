import { downloadBlobBuffer } from "@/lib/storage/blob"

/**
 * D-ID `POST /talks` validates `source_url` with a strict pattern (must end in .jpg/.png, no odd query strings).
 * Vercel **private** blob signed URLs use `*.private.blob.vercel-storage.com/...?download=1` and are rejected as
 * "Unsupported file url". D-ID's `POST /images` accepts multipart bytes and returns a temporary HTTPS URL that
 * works as `source_url`.
 */
export async function didSourceUrlFromHeadshotBuffer(
  headshotImageUrl: string,
  didAuthHeader: string
): Promise<string> {
  const { buffer, contentType } = await downloadBlobBuffer(headshotImageUrl)
  const lower = headshotImageUrl.toLowerCase()
  const isPng =
    contentType.includes("png") || lower.endsWith(".png") || lower.includes(".png?")
  const ext = isPng ? "png" : "jpg"
  const mime = isPng ? "image/png" : "image/jpeg"

  const form = new FormData()
  form.append(
    "image",
    new Blob([new Uint8Array(buffer)], { type: mime }),
    `headshot.${ext}`
  )

  const res = await fetch("https://api.d-id.com/images", {
    method: "POST",
    headers: { Authorization: didAuthHeader },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `D-ID image upload failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
    )
  }

  const json = (await res.json()) as { url?: string }
  if (!json.url?.trim()) {
    throw new Error("D-ID image upload: missing url in response")
  }
  return json.url.trim()
}
