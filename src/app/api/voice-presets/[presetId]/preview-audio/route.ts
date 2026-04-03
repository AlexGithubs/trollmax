import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import {
  getVoicePresetById,
  resolvePresetProviderVoiceId,
} from "@/lib/voice-presets/catalog"
import { fetchElevenLabsPreviewAudioForVoice } from "@/lib/voice-presets/elevenlabs-voice-preview"
import { get as getBlob, put as putBlob } from "@vercel/blob"

/**
 * Proxies ElevenLabs preview (CDN or sample audio API) through our origin so the
 * client can `new Audio(sameOriginUrl).play()` from a click handler.
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
    return new NextResponse(null, { status: 404 })
  }

  const voiceId = resolvePresetProviderVoiceId(preset)
  if (!voiceId) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[preview-audio] missing voice id — set env:",
        preset.providerVoiceIdEnv,
        "preset:",
        preset.id
      )
    }
    return new NextResponse(null, { status: 404 })
  }

  // Persist the generated preview so subsequent clicks/users don't have to
  // redo the ElevenLabs TTS fallback.
  const cachePath = `voice-presets/previews/${voiceId}.mp3`
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const cached = await getBlob(cachePath, { access: "public" })
      if (cached?.statusCode === 200 && cached?.stream) {
        const contentType =
          (cached.blob && (cached.blob as any).contentType) || "audio/mpeg"
        return new NextResponse(cached.stream as any, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            // Preview is immutable once created; safe to cache aggressively.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        })
      }
    } catch {
      // Cache miss or permissions; fall back to generating below.
    }
  }

  const audio = await fetchElevenLabsPreviewAudioForVoice(voiceId)
  if (!audio) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[preview-audio] no preview/sample audio for voice", preset.id, voiceId)
    }
    return new NextResponse(null, { status: 404 })
  }

  // Store in Vercel Blob (mp3 path). Even if the upstream contentType isn't
  // exactly mp3, the TTS fallback is mp3 so subsequent reads will be stable.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await putBlob(cachePath, audio.bytes, { access: "public", contentType: audio.contentType })
    } catch {
      // Non-fatal: still return the freshly generated audio.
    }
  }

  // Return freshly generated audio.
  const body = new Blob([new Uint8Array(audio.bytes)], { type: audio.contentType })
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Content-Length": String(audio.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
