import type Replicate from "replicate"
import { downloadBlobBuffer, isPrivateVercelBlobUrl } from "@/lib/storage/blob"

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
 * URL that Replicate model runners can fetch. Vercel **private** blob URLs are not
 * anonymously readable (no stable public/signed URL for third-party GET). We download
 * with our token and upload via `replicate.files.create`; models receive
 * `https://api.replicate.com/v1/files/...` which Replicate serves to the runtime.
 */
export async function urlForReplicateModelInput(
  replicate: InstanceType<typeof Replicate>,
  sourceHttpUrl: string,
  options?: { filenameStem?: string }
): Promise<string> {
  const u = sourceHttpUrl.trim()
  if (!u.startsWith("http")) return u
  if (!isPrivateVercelBlobUrl(u)) return u

  const { buffer, contentType } = await downloadBlobBuffer(u)
  const stem = options?.filenameStem ?? "input"
  const name = filenameForContentType(contentType, stem)
  const ct = contentType || "application/octet-stream"
  const file = new File([new Uint8Array(buffer)], name, { type: ct })

  const created = await replicate.files.create(file)
  const getUrl = created.urls?.get
  if (!getUrl || typeof getUrl !== "string") {
    throw new Error("Replicate files.create did not return urls.get")
  }
  return getUrl
}
