import { NextResponse } from "next/server"

const ALLOWED_HOST = "upload.wikimedia.org"
const PATH_PREFIX = "/wikipedia/commons/"

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:") return false
    if (u.hostname !== ALLOWED_HOST) return false
    if (!u.pathname.startsWith(PATH_PREFIX)) return false
    if (u.pathname.includes("..")) return false
    return true
  } catch {
    return false
  }
}

/**
 * Server-side fetch for preset headshots so the browser avoids CORS issues with Wikimedia.
 * Only https://upload.wikimedia.org/wikipedia/commons/* is allowed.
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u")?.trim() ?? ""
  if (!u || u.length > 2048 || !isAllowedImageUrl(u)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 })
  }

  const upstream = await fetch(u, {
    headers: { "User-Agent": "TrollmaxHeadshotPreset/1.0 (contact: site operator)" },
    // Avoid Next.js data cache (2MB cap) on large Commons originals when URLs slip through.
    cache: "no-store",
  })

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Could not load image" },
      { status: upstream.status === 404 ? 404 : 502 }
    )
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 400 })
  }

  const buf = Buffer.from(await upstream.arrayBuffer())
  if (buf.length > 12_000_000) {
    return NextResponse.json({ error: "Image too large" }, { status: 400 })
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
