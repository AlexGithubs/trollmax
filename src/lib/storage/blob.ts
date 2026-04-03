/**
 * Vercel Blob adapter.
 * Only used when BLOB_READ_WRITE_TOKEN is set.
 *
 * Stores are often **private-only** in Vercel (no public access). All uploads use
 * `access: "private"` by default. For Replicate, D-ID, Modal, etc., use
 * {@link blobUrlForExternalFetch} to obtain a short-lived signed URL.
 */
import { del, head, put } from "@vercel/blob"
import type { FileStore } from "./types"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntilBlobIsReadable(url: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" })
      if (res.ok) return
    } catch {
      // Retry on transient network errors.
    }
    await sleep(400 * (attempt + 1))
  }
}

/** True when the URL is a Vercel Blob that is not on the public CDN hostname. */
export function isPrivateVercelBlobUrl(url: string): boolean {
  return (
    url.includes("blob.vercel-storage.com") &&
    !url.includes(".public.blob.vercel-storage.com")
  )
}

/**
 * Replicate, D-ID, Whisper-on-Replicate, Modal FFmpeg, etc. fetch assets without our auth.
 * Private blob canonical URLs are not directly readable; use a signed `downloadUrl`.
 * Public blob URLs and normal HTTPS URLs are returned unchanged.
 */
export async function blobUrlForExternalFetch(url: string): Promise<string> {
  const u = url.trim()
  if (!u.startsWith("http")) return u
  if (!isPrivateVercelBlobUrl(u)) return u
  const meta = await head(u)
  const signed = meta.downloadUrl
  if (!signed) {
    throw new Error("blobUrlForExternalFetch: missing downloadUrl for private blob")
  }
  return signed
}

/**
 * Download a Vercel Blob (public or private) server-side and return its buffer.
 * For private blobs the Vercel Blob SDK is used to obtain a signed download URL
 * before fetching — the BLOB_READ_WRITE_TOKEN env var must be set.
 */
export async function downloadBlobBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  let fetchUrl = url
  let contentTypeHint = "audio/mpeg"

  if (isPrivateVercelBlobUrl(url)) {
    const meta = await head(url)
    fetchUrl = meta.downloadUrl
    contentTypeHint = meta.contentType ?? contentTypeHint
  }

  const res = await fetch(fetchUrl, { redirect: "follow" })
  if (!res.ok) {
    throw new Error(`downloadBlobBuffer: fetch failed (${res.status}) for ${url.slice(0, 80)}`)
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type")?.split(";")[0]?.trim() ?? contentTypeHint,
  }
}

export class VercelBlobStore implements FileStore {
  /**
   * Defaults to **private** — required when the Vercel Blob store is configured
   * as private-only ("Cannot use public access on a private store").
   */
  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
    access: "public" | "private" = "private"
  ): Promise<{ url: string }> {
    const blob = await put(path, buffer, { access, contentType })
    if (access === "public" && blob.url.includes(".public.blob.vercel-storage.com")) {
      await waitUntilBlobIsReadable(blob.url)
    }
    return { url: blob.url }
  }

  async delete(url: string): Promise<void> {
    await del(url)
  }
}
