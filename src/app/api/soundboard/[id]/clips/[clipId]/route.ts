import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import { blobUrlForExternalFetch } from "@/lib/storage/blob"
import type { SoundboardManifest } from "@/lib/manifests/types"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url: string): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) return res
      lastResponse = res
      if (res.status !== 503 && res.status !== 429 && res.status < 500) break
    } catch {
      // Retry transient fetch errors.
    }

    await sleep(300 * (attempt + 1))
  }

  if (lastResponse) return lastResponse
  throw new Error("Clip fetch failed")
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const { id, clipId } = await params
  const store = getManifestStore()
  const raw = await store.get(`soundboard:${id}`)
  if (!raw) {
    return new Response("Not found", { status: 404 })
  }

  const manifest = JSON.parse(raw) as SoundboardManifest
  const user = await currentUser()
  const canAccess = manifest.isPublic || (user && manifest.ownerId === user.id)
  if (!canAccess) {
    return new Response("Forbidden", { status: 403 })
  }

  const clip = manifest.clips.find((item) => item.id === clipId)
  if (!clip) {
    return new Response("Not found", { status: 404 })
  }

  const sourceUrl = clip.sourceUrl ?? clip.audioUrl
  if (!sourceUrl.startsWith("http")) {
    return new Response("Invalid clip source", { status: 400 })
  }

  let upstream: Response
  try {
    const fetchUrl = await blobUrlForExternalFetch(sourceUrl)
    upstream = await fetchWithRetry(fetchUrl)
  } catch {
    return new Response("Clip unavailable", { status: 503 })
  }

  if (!upstream.ok) {
    return new Response("Clip unavailable", { status: 503 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
