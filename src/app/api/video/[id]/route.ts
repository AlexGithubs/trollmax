import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore, getFileStore } from "@/lib/storage"
import type { VideoManifest } from "@/lib/manifests/types"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const manifest = JSON.parse(raw) as VideoManifest
  if (manifest.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Clean up the headshot blob if it was never cleared (e.g. video deleted before or during generation)
  if (manifest.headshotImageUrl) {
    await getFileStore().delete(manifest.headshotImageUrl).catch((err) => {
      console.warn("[video DELETE] headshot cleanup failed:", err)
    })
  }

  await store.del(`video:${id}`)
  await store.srem(`user:${user.id}:videos`, id)

  return NextResponse.json({ ok: true })
}
