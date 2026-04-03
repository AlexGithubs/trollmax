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
  req: Request,
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
  } catch (err) {
    console.error("[soundboard/clips] blob fetch setup failed:", clipId, err)
    return new Response("Clip unavailable", { status: 503 })
  }

  if (!upstream.ok) {
    console.error(
      "[soundboard/clips] upstream not ok:",
      clipId,
      upstream.status,
      sourceUrl.slice(0, 80)
    )
    return new Response("Clip unavailable", { status: 503 })
  }

  // Buffer instead of piping upstream.body — streaming passthrough often returns 503 on Vercel
  // when the fetch ReadableStream does not complete cleanly in the platform.
  let buf: Buffer
  try {
    buf = Buffer.from(await upstream.arrayBuffer())
  } catch (err) {
    console.error("[soundboard/clips] arrayBuffer failed:", clipId, err)
    return new Response("Clip unavailable", { status: 503 })
  }

  const contentType = upstream.headers.get("content-type") ?? "audio/mpeg"
  const total = buf.length
  const range = req.headers.get("range")

  if (range && total > 0) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range.trim())
    if (m) {
      const start = Math.min(parseInt(m[1], 10), Math.max(0, total - 1))
      let end = m[2] ? parseInt(m[2], 10) : total - 1
      end = Math.min(end, total - 1)
      if (start <= end) {
        const chunk = new Uint8Array(buf.subarray(start, end + 1))
        return new Response(chunk, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunk.length),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600",
          },
        })
      }
    }
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
