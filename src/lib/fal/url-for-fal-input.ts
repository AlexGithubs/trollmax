import { downloadBlobBuffer } from "@/lib/storage/blob"

function filenameForContentType(contentType: string, stem: string): string {
  const m = contentType.split(";")[0].trim().toLowerCase()
  const ext =
    m === "image/jpeg" || m === "image/jpg"
      ? "jpg"
      : m === "image/png"
        ? "png"
        : m === "image/webp"
          ? "webp"
          : m === "image/gif"
            ? "gif"
            : m === "audio/wav" || m === "audio/x-wav"
              ? "wav"
              : m === "audio/mpeg" || m === "audio/mp3"
                ? "mp3"
                : m === "audio/mp4" || m === "audio/m4a" || m === "audio/x-m4a"
                  ? "m4a"
                  : "bin"
  return `${stem}.${ext}`
}

/**
 * Build a File for fal from any HTTP(S) URL we can read server-side (public URL or
 * private Vercel Blob via {@link downloadBlobBuffer}). Prefer this over passing raw
 * URLs into fal: third-party hosts may block fal's runners or return 403.
 */
export async function fileFromHttpUrlForFal(
  sourceHttpUrl: string,
  options?: { filenameStem?: string }
): Promise<File> {
  const { buffer, contentType } = await downloadBlobBuffer(sourceHttpUrl.trim())
  const stem = options?.filenameStem ?? "input"
  const name = filenameForContentType(contentType, stem)
  const ct = contentType || "application/octet-stream"
  return new File([new Uint8Array(buffer)], name, { type: ct })
}
