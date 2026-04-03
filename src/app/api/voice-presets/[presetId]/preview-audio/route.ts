import { NextResponse } from "next/server"
import {
  getVoicePresetById,
  resolvePresetProviderVoiceId,
} from "@/lib/voice-presets/catalog"
import { fetchElevenLabsPreviewAudioForVoice } from "@/lib/voice-presets/elevenlabs-voice-preview"
import { put as putBlob } from "@vercel/blob"

/**
 * Proxies ElevenLabs preview audio through our origin.
 *
 * We always download bytes server-side (via fetchElevenLabsPreviewAudioForVoice)
 * which handles CDN fetch with the correct headers, sample audio fallback, and
 * TTS synthesis fallback. Redirecting the browser to ElevenLabs CDN URLs directly
 * does NOT work — those URLs require specific server-side headers and are not
 * publicly accessible from browsers.
 *
 * After serving, we fire-and-forget a write to Vercel Blob so future server
 * instances can reuse the bytes without calling ElevenLabs again (handled
 * inside fetchElevenLabsPreviewAudioForVoice's in-process TTS cache for warm
 * invocations; Blob provides cross-invocation persistence when available).
 *
 * Supports byte-range requests (RFC 7233) — iOS Safari requires range support
 * to play audio via HTMLAudioElement and silently fails without it.
 *
 * No auth required — previews are free samples available to all visitors.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ presetId: string }> }
) {
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

  // Always fetch bytes server-side. This function tries ElevenLabs CDN,
  // then sample audio, then TTS synthesis as fallback — each step uses the
  // correct server-side headers so all voices work regardless of CDN access.
  const audio = await fetchElevenLabsPreviewAudioForVoice(voiceId)
  if (!audio) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[preview-audio] no audio for voice",
        preset.id,
        voiceId
      )
    }
    return new NextResponse(null, { status: 404 })
  }

  // Fire-and-forget: cache to Vercel Blob so warm serverless instances benefit
  // from the in-process TTS cache and cold starts can be optimised later.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    putBlob(
      `voice-presets/previews/${voiceId}.mp3`,
      audio.bytes,
      {
        access: "private",
        contentType: audio.contentType,
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    ).catch(() => {
      // Non-fatal — still serving bytes below.
    })
  }

  // Serve with full byte-range support (RFC 7233).
  // iOS Safari probes with Range: bytes=0-1 before playing; without a 206
  // response it silently refuses to play the audio.
  const bytes = audio.bytes
  const total = bytes.length
  const range = req.headers.get("range")

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    if (m) {
      const start = parseInt(m[1], 10)
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1
      const chunk = bytes.slice(start, end + 1)
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": audio.contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": audio.contentType,
      "Content-Length": String(total),
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
