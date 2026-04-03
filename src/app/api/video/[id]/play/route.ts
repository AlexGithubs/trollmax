import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import { blobUrlForExternalFetch } from "@/lib/storage/blob"
import type { VideoManifest } from "@/lib/manifests/types"

/**
 * Stream completed video from Vercel Blob (private or public) to the browser.
 * Direct blob URLs are not playable for private stores without a signed URL;
 * this route authorizes then proxies bytes.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)
  if (!raw) return new Response("Not found", { status: 404 })

  const manifest = JSON.parse(raw) as VideoManifest
  const user = await currentUser()
  const allowed = manifest.isPublic || (user ? manifest.ownerId === user.id : false)
  if (!allowed) return new Response("Forbidden", { status: 403 })

  if (manifest.status !== "complete" || !manifest.videoUrl?.trim().startsWith("http")) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const fetchUrl = await blobUrlForExternalFetch(manifest.videoUrl.trim())
    const upstream = await fetch(fetchUrl)
    if (!upstream.ok) {
      return new Response("Video temporarily unavailable", { status: 502 })
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch {
    return new Response("Video unavailable", { status: 502 })
  }
}
