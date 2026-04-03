/**
 * Vercel Blob adapter.
 * Only used when BLOB_READ_WRITE_TOKEN is set.
 */
import { del, head, put } from "@vercel/blob"
import type { FileStore } from "./types"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntilBlobIsReadable(url: string): Promise<void> {
  // Blob propagation can be briefly eventual; avoid returning URLs that still 503.
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

/**
 * Returns true if the URL points to a private (non-CDN) Vercel Blob.
 * Public blobs contain ".public.blob.vercel-storage.com"; private blobs do not.
 */
function isPrivateVercelBlob(url: string): boolean {
  return (
    url.includes("blob.vercel-storage.com") &&
    !url.includes(".public.blob.vercel-storage.com")
  )
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

  if (isPrivateVercelBlob(url)) {
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
  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
    access: "public" | "private" = "public"
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
