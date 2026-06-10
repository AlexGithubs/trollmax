import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { activePresetsHaveElevenLabsVoiceIds } from "@/lib/voice-presets/catalog"

/**
 * Which voice backends are configured (no secrets exposed).
 * In production, anonymous callers only get `{ ok: true }` to reduce fingerprinting;
 * signed-in users receive full flags for the in-app forms.
 */
export async function GET() {
  const user = await currentUser()
  const reveal =
    process.env.NODE_ENV !== "production" || Boolean(user?.id)

  if (!reveal) {
    return NextResponse.json({ ok: true as const })
  }

  const elevenlabs = Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  return NextResponse.json({
    elevenlabs,
    /** Preset characters need one VOICE_PRESET_*_PROVIDER_ID each; uploads only need the API key. */
    elevenlabsPresetVoicesReady: elevenlabs && activePresetsHaveElevenLabsVoiceIds(),
  })
}
