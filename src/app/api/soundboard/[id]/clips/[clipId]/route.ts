import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import { downloadBlobBuffer } from "@/lib/storage/blob"
import type { SoundboardManifest } from "@/lib/manifests/types"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function downloadClipWithRetry(
  sourceUrl: string
): Promise<{ buffer: Buffer; contentType: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await downloadBlobBuffer(sourceUrl)
    } catch (e) {
      lastErr = e
      await sleep(300 * (attempt + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Clip fetch failed")
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

  let buf: Buffer
  let contentType: string
  try {
    const d = await downloadClipWithRetry(sourceUrl)
    buf = d.buffer
    contentType = d.contentType || "audio/mpeg"
  } catch (err) {
    console.error("[soundboard/clips] download failed:", clipId, sourceUrl.slice(0, 80), err)
    return new Response("Clip unavailable", { status: 503 })
  }
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
