"use client"

/**
 * Client-direct upload to Vercel Blob.
 *
 * Files are uploaded straight from the browser to Blob storage, then a small
 * JSON "finalize" call processes the stored blob server-side. This bypasses the
 * ~4.5 MB request-body limit that Vercel serverless functions enforce — the limit
 * that caused large camera-roll videos and phone photos to fail with "Load failed"
 * when posted through a route handler.
 */
import { upload } from "@vercel/blob/client"

export type BlobUploadKind = "voice" | "headshot"

/** Files above this size use multipart upload for resilience on flaky mobile networks. */
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024

function safeExt(fileName: string, fallback: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""
  return ext || fallback
}

/**
 * Uploads a raw file directly to Blob and returns the resulting (private) blob URL.
 * The caller then posts this URL to the matching finalize endpoint for processing.
 */
export async function uploadRawFileToBlob(
  file: File,
  kind: BlobUploadKind,
  opts: {
    /** Clerk user id — used to scope the storage path. Required (sign-in enforced upstream). */
    userId: string
    onProgress?: (percentage: number) => void
    signal?: AbortSignal
  }
): Promise<string> {
  const base = kind === "headshot" ? "headshot" : "voice"
  const ext = safeExt(file.name, kind === "headshot" ? "jpg" : "bin")
  const pathname = `samples/${opts.userId}/raw/${base}.${ext}`

  const result = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload-token",
    contentType: file.type || undefined,
    clientPayload: JSON.stringify({ kind }),
    multipart: file.size > MULTIPART_THRESHOLD_BYTES,
    ...(opts.onProgress
      ? { onUploadProgress: (p) => opts.onProgress!(p.percentage) }
      : {}),
    ...(opts.signal ? { abortSignal: opts.signal } : {}),
  })

  return result.url
}
