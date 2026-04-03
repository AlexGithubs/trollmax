import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import {
  getVoicePresetById,
  resolvePresetProviderVoiceId,
} from "@/lib/voice-presets/catalog"
import { fetchElevenLabsVoicePreviewUrl } from "@/lib/voice-presets/elevenlabs-voice-preview"

/**
 * Returns `{ previewUrl: string | null }` for the preset's configured ElevenLabs voice.
 * `previewUrl` is null if the voice has no preview, env is missing, or ElevenLabs errors.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ presetId: string }> }
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { presetId } = await params
  const preset = getVoicePresetById(decodeURIComponent(presetId))
  if (!preset) {
    return NextResponse.json({ error: "Unknown preset" }, { status: 404 })
  }
  if (preset.status !== "active") {
    return NextResponse.json({ previewUrl: null })
  }

  const voiceId = resolvePresetProviderVoiceId(preset)
  if (!voiceId) {
    return NextResponse.json({ previewUrl: null })
  }

  const previewUrl = await fetchElevenLabsVoicePreviewUrl(voiceId)
  // Preset voice metadata is immutable — cache aggressively at the CDN edge.
  // In-memory cache (6h TTL) handles within-instance deduplication; the CDN
  // layer handles cross-instance and cold-start deduplication.
  return NextResponse.json(
    { previewUrl },
    { headers: { "Cache-Control": "public, max-age=21600, s-maxage=86400, stale-while-revalidate=3600" } }
  )
}
