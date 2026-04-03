import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest } from "@/lib/manifests/types"
import { getTtsProviderForTier } from "@/lib/providers"
import { resolveManifestTtsTier } from "@/lib/tts/tiers"

export async function DELETE(
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

  if (process.env.NEXT_PUBLIC_MOCK_MODE !== "true") {
    try {
      const tier = resolveManifestTtsTier(manifest)
      if (
        tier === "elevenlabs" &&
        !manifest.voicePresetId &&
        manifest.voiceId.trim() !== manifest.voiceSampleUrl.trim()
      ) {
        await getTtsProviderForTier("elevenlabs").deleteVoice(manifest.voiceId.trim())
      }
    } catch (err) {
      console.warn("[soundboard DELETE] provider cleanup:", err)
    }
  }

  await store.del(`soundboard:${id}`)
  await store.srem(`user:${user.id}:soundboards`, id)

  return NextResponse.json({ ok: true })
}
