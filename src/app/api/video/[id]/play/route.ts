export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import { downloadBlobBuffer } from "@/lib/storage/blob"
import type { VideoManifest } from "@/lib/manifests/types"

/**
 * Stream a completed video to the browser with full byte-range support.
 *
 * Private Vercel Blob URLs require `Authorization: Bearer` — browsers cannot
 * fetch them directly. This route downloads bytes server-side (authenticated)
 * and proxies them, supporting RFC 7233 range requests so seekable playback
 * and iOS Safari work correctly.
 */
export async function GET(
  req: Request,
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
    return new Response("Not ready", { status: 404 })
  }

  let buffer: Buffer
  let contentType: string
  try {
    const result = await downloadBlobBuffer(manifest.videoUrl.trim())
    buffer = result.buffer
    contentType = result.contentType || "video/mp4"
  } catch {
    return new Response("Video unavailable", { status: 502 })
  }

  const total = buffer.length
  const range = req.headers.get("range")

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    if (m) {
      const start = parseInt(m[1], 10)
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1
      const chunk = buffer.subarray(start, end + 1)
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=300",
        },
      })
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(total),
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  })
}
