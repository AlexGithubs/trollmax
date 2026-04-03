/**
 * Dev-only route that serves files saved by LocalFileStore.
 * In production this route is never hit — files are served from Vercel Blob.
 */
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DEV_ASSETS_DIR = path.join(process.cwd(), ".dev-assets")

const EXT_TO_MIME: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { path: segments } = await params
  const fileName = segments.join("-")
  const filePath = path.join(DEV_ASSETS_DIR, fileName)

  if (!filePath.startsWith(DEV_ASSETS_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream"
  const buffer = fs.readFileSync(filePath)

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  })
}
