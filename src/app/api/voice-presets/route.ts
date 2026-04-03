import { NextResponse } from "next/server"
import { voicePresetsApiPayload } from "@/lib/voice-presets/catalog"

/** Public metadata for preset picker UI (no ref audio URLs or transcripts). */
export async function GET() {
  return NextResponse.json(voicePresetsApiPayload())
}
