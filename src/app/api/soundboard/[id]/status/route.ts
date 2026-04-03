import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest } from "@/lib/manifests/types"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`soundboard:${id}`)
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const manifest = JSON.parse(raw) as SoundboardManifest
  if (manifest.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Redact raw provider error details from the client-facing response.
  const safeLastError = manifest.lastError
    ? manifest.lastError.replace(
        /\b(Basic [^\s]+|Bearer [^\s]+|sk-[A-Za-z0-9]+|key-[A-Za-z0-9]+)\b/gi,
        "[REDACTED]"
      )
    : null

  return NextResponse.json({
    status: manifest.status ?? (manifest.clips?.length ? "complete" : "draft"),
    progressStep: manifest.progressStep ?? null,
    progressPct: typeof manifest.progressPct === "number" ? manifest.progressPct : null,
    progressDetail: manifest.progressDetail ?? null,
    lastError: safeLastError,
    clipCount: Array.isArray(manifest.clips) ? manifest.clips.length : 0,
    phraseCount: Array.isArray(manifest.phrases) ? manifest.phrases.length : 0,
  })
}

