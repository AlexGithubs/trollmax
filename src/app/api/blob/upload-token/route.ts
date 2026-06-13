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
  voice: 210 * 1024 * 1024, // video-with-audio sources can be large (phone 4K/HEVC)
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
      // NOTE: intentionally NO onUploadCompleted. Defining it (even as a no-op) makes the
      // SDK embed a callback URL in the client token; the Blob API then gates the upload's
      // completion on invoking that webhook. When the callback isn't reachable (localhost,
      // or a deployment that can't call itself), the upload hangs at 0% forever. We process
      // the file via an explicit client finalize call instead, so no webhook is needed.
    })
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start upload." },
      { status: 400 }
    )
  }
}
