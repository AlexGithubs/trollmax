import { currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

/**
 * Which TTS backends are configured (no secrets exposed).
 * In production, anonymous callers only get `{ ok: true }` to reduce fingerprinting;
 * signed-in users receive full flags for the in-app picker.
 */
export async function GET() {
  const user = await currentUser()
  const reveal =
    process.env.NODE_ENV !== "production" || Boolean(user?.id)

  if (!reveal) {
    return NextResponse.json({ ok: true as const })
  }

  return NextResponse.json({
    replicate: Boolean(process.env.REPLICATE_API_TOKEN?.trim()),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
  })
}
