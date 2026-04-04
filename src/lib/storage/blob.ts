import { getBlobPutAccess } from "./blob-env-sync"

/**
 * Vercel Blob adapter.
 * Only used when BLOB_READ_WRITE_TOKEN is set.
 *
 * Prefer a **private** Vercel Blob store. Upload access defaults to `getBlobPutAccess()`
 * (`private`, or `public` when `BLOB_UPLOAD_ACCESS=public` matches a public-only store).
 * For Replicate, D-ID, Modal, etc., use {@link blobUrlForExternalFetch} for private blobs.
 */
import { del, get, head, put } from "@vercel/blob"
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
 * Replicate, Whisper-on-Replicate, Modal FFmpeg, etc. fetch assets without our auth.
 * D-ID rejects Vercel private signed URLs for `source_url` and `audio_url`; use `POST /images` and
 * `POST /audios` instead (`didSourceUrlFromHeadshotBuffer`, `didAudioUrlFromBlobUrl`). Private blob
 * canonical URLs are not anonymously readable;
 * `head().downloadUrl` is not enough for server-side `fetch` (403). For **this app’s server**, use
 * {@link downloadBlobBuffer} (`get` + bearer). For **third-party HTTP** fetchers, `downloadUrl` may still apply.
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
 *
 * **Private** blobs must be read with `get(..., { access: "private" })` so the SDK
 * sends `Authorization: Bearer` — anonymous `fetch(head().downloadUrl)` returns 403.
 */
export async function downloadBlobBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const u = url.trim()
  if (isPrivateVercelBlobUrl(u)) {
    let result = await get(u, { access: "private", useCache: false })
    // 304 Not Modified returns stream: null — retry once (should not happen without ifNoneMatch).
    if (result?.statusCode === 304) {
      result = await get(u, { access: "private", useCache: false })
    }
    if (result === null) {
      throw new Error(
        "Stored file was not found in Blob storage (it may have been deleted). Re-upload your voice sample or photo and try again."
      )
    }
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error(
        `downloadBlobBuffer: private blob unreadable (HTTP ${result.statusCode}) for ${u.slice(0, 120)}`
      )
    }
    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer())
    const contentType =
      result.blob.contentType?.split(";")[0]?.trim() || "application/octet-stream"
    return { buffer, contentType }
  }

  const res = await fetch(u, { redirect: "follow" })
  if (!res.ok) {
    throw new Error(`downloadBlobBuffer: fetch failed (${res.status}) for ${u.slice(0, 120)}`)
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType:
      res.headers.get("content-type")?.split(";")[0]?.trim() ?? "audio/mpeg",
  }
}

export class VercelBlobStore implements FileStore {
  /**
   * Uses {@link getBlobPutAccess} when `access` is omitted (see `BLOB_UPLOAD_ACCESS`).
   */
  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
    access?: "public" | "private"
  ): Promise<{ url: string }> {
    const resolved = access ?? getBlobPutAccess()
    const blob = await put(path, buffer, { access: resolved, contentType })
    if (resolved === "public" && blob.url.includes(".public.blob.vercel-storage.com")) {
      await waitUntilBlobIsReadable(blob.url)
    }
    return { url: blob.url }
  }

  async delete(url: string): Promise<void> {
    await del(url)
  }
}
