import type { VideoManifest } from "@/lib/manifests/types"
import {
  hasVideoDraftContent,
  type VideoDraftUpsertBody,
} from "@/lib/video/video-draft"

export const VIDEO_NEW_HREF = "/app/video/new?new=1"

export function videoEditHref(id: string): string {
  return `/app/video/new?id=${encodeURIComponent(id)}`
}

export async function loadVideoDraftManifest(id: string): Promise<VideoManifest | null> {
  const res = await fetch(`/api/video/${encodeURIComponent(id)}`, { method: "GET" })
  if (!res.ok) return null
  return (await res.json()) as VideoManifest
}

export async function upsertVideoDraft(
  body: VideoDraftUpsertBody
): Promise<{ id: string } | null> {
  if (!hasVideoDraftContent(body)) return null

  const res = await fetch("/api/video/draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null
  const data = (await res.json()) as { id?: string }
  return data.id ? { id: data.id } : null
}
