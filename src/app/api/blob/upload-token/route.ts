export const runtime = "nodejs"

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * Issues short-lived client-upload tokens for direct-to-Blob uploads.
 *
 * Auth + rate limiting happen here (before any bytes move), and the storage path
 * is locked to the signed-in user. Actual processing (audio extraction, headshot
 * normalization, duration checks) is done by the matching finalize routes that the
 * client calls once the raw blob exists.
 */

/** Generous ceilings — the finalize routes enforce the real product limits. */
const MAX_BYTES: Record<string, number> = {
  voice: 120 * 1024 * 1024, // video-with-audio sources can be large
  headshot: 30 * 1024 * 1024,
}

function kindFromPayload(clientPayload: string | null): string {
  try {
    const parsed = JSON.parse(clientPayload ?? "{}") as { kind?: unknown }
    if (parsed.kind === "headshot" || parsed.kind === "voice") return parsed.kind
  } catch {
    // fall through
  }
  return "voice"
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to upload.", code: "UNAUTHENTICATED" },
      { status: 401 }
    )
  }

  let body: HandleUploadBody
  try {
    body = (await req.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { allowed } = await checkRateLimit(user.id, "upload")
        if (!allowed) throw new Error("Rate limit exceeded. Try again later.")

        const expectedPrefix = `samples/${user.id}/raw/`
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Upload path is not allowed for this account.")
        }

        const kind = kindFromPayload(clientPayload)
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_BYTES[kind] ?? MAX_BYTES.voice,
          tokenPayload: JSON.stringify({ userId: user.id, kind }),
        }
      },
      // Processing is triggered by an explicit client finalize call so the user gets
      // a synchronous result; this webhook is intentionally a no-op (and is not
      // reachable on localhost anyway).
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start upload." },
      { status: 400 }
    )
  }
}
