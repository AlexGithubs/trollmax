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

  // Single-shot upload (no multipart). Multipart client uploads were stalling at 0% on
  // both desktop and mobile for large files; a single PUT is simpler, reports byte-level
  // progress continuously, and reliably handles the file sizes we accept here.
  const result = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload-token",
    contentType: file.type || undefined,
    clientPayload: JSON.stringify({ kind }),
    multipart: false,
    ...(opts.onProgress
      ? { onUploadProgress: (p) => opts.onProgress!(p.percentage) }
      : {}),
    ...(opts.signal ? { abortSignal: opts.signal } : {}),
  })

  return result.url
}

/** Two observable phases of a finalize-backed upload, for UI feedback. */
export type UploadPhase = "transfer" | "processing"

/**
 * Hard ceilings so an upload can never spin forever (the "endless uploading"
 * failure mode). The transfer cap is generous for big videos on slow mobile
 * links; the processing cap matches the finalize route's server budget.
 */
const TRANSFER_TIMEOUT_MS = 5 * 60 * 1000
const FINALIZE_TIMEOUT_MS = 125 * 1000

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
}

/**
 * Uploads a file directly to Blob, then calls its finalize endpoint to process
 * the stored blob server-side. Reports progress + phase and enforces timeouts so
 * the caller always settles with a result or an actionable error — never a hang.
 */
export async function uploadAndFinalize<T>(opts: {
  file: File
  kind: BlobUploadKind
  userId: string
  /** Finalize route that processes the raw blob, e.g. "/api/upload". */
  finalizeUrl: string
  onPhase?: (phase: UploadPhase) => void
  onProgress?: (percentage: number) => void
  transferTimeoutMs?: number
  finalizeTimeoutMs?: number
}): Promise<T> {
  const transferTimeoutMs = opts.transferTimeoutMs ?? TRANSFER_TIMEOUT_MS
  const finalizeTimeoutMs = opts.finalizeTimeoutMs ?? FINALIZE_TIMEOUT_MS

  opts.onPhase?.("transfer")
  opts.onProgress?.(0)

  const transferController = new AbortController()
  const transferTimer = setTimeout(() => transferController.abort(), transferTimeoutMs)
  let rawUrl: string
  try {
    rawUrl = await uploadRawFileToBlob(opts.file, opts.kind, {
      userId: opts.userId,
      signal: transferController.signal,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    })
  } catch (err) {
    if (isAbortError(err) || transferController.signal.aborted) {
      throw new Error(
        "Upload stalled — your connection dropped or it's too slow. Reconnect and try again, or use a smaller file."
      )
    }
    throw err instanceof Error ? err : new Error("Upload failed. Please try again.")
  } finally {
    clearTimeout(transferTimer)
  }

  opts.onPhase?.("processing")

  const finalizeController = new AbortController()
  const finalizeTimer = setTimeout(() => finalizeController.abort(), finalizeTimeoutMs)
  try {
    const res = await fetch(opts.finalizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawUrl }),
      signal: finalizeController.signal,
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Upload failed. Please try again.")
    }
    return data
  } catch (err) {
    if (isAbortError(err) || finalizeController.signal.aborted) {
      throw new Error(
        "Processing your file took too long. Try a shorter clip or a smaller/lower-resolution file."
      )
    }
    throw err instanceof Error ? err : new Error("Upload failed. Please try again.")
  } finally {
    clearTimeout(finalizeTimer)
  }
}
