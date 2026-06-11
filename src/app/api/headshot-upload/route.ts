export const runtime = "nodejs"
// Downloading a large phone photo (HEIC/PNG) from Blob and normalizing it with sharp
// can exceed the default function budget; give it headroom so big uploads don't hang.
export const maxDuration = 60

import { BlobNotFoundError } from "@vercel/blob"
import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { getFileStore } from "@/lib/storage"
import { downloadBlobBuffer } from "@/lib/storage/blob"
import { userOwnsSampleUploadUrl } from "@/lib/storage/sample-upload-url"
import { checkRateLimit } from "@/lib/rate-limit"
import { normalizeHeadshotToJpeg } from "@/lib/media/normalize-headshot"
import { z } from "zod"

/** Raw uploads can be larger (HEIC, PNG); output JPEG is capped inside normalize. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

const FinalizeBodySchema = z.object({
  /** URL of the raw image the client uploaded directly to Blob. */
  rawUrl: z.string().min(1),
})

/**
 * Finalizes a headshot uploaded directly to Blob by the client. Downloads the raw
 * image, normalizes it to a capped JPEG, stores the result, and deletes the raw
 * upload. The request body carries only a URL, so large phone photos (HEIC/PNG) are
 * no longer blocked by the ~4.5 MB serverless body limit.
 */
export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to upload.", code: "UNAUTHENTICATED" },
      { status: 401 }
    )
  }

  const { allowed } = await checkRateLimit(user.id, "upload")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const json = await req.json().catch(() => null)
  const parsed = FinalizeBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const rawUrl = parsed.data.rawUrl
  if (!userOwnsSampleUploadUrl(rawUrl, user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const fileStore = getFileStore()
  const deleteRaw = () => fileStore.delete(rawUrl).catch(() => {})

  let inputBuffer: Buffer
  try {
    const downloaded = await downloadBlobBuffer(rawUrl)
    inputBuffer = downloaded.buffer
  } catch (err) {
    console.error("[headshot-upload] could not read raw upload:", err)
    return NextResponse.json(
      { error: "Could not read that photo. Please try again." },
      { status: 400 }
    )
  }

  if (inputBuffer.length > MAX_INPUT_BYTES) {
    await deleteRaw()
    return NextResponse.json(
      { error: `File too large (max ~25 MB before conversion). Try a smaller image.` },
      { status: 400 }
    )
  }

  let jpegBuffer: Buffer
  try {
    jpegBuffer = await normalizeHeadshotToJpeg(inputBuffer)
  } catch (err) {
    console.error("[headshot-upload] normalize failed:", err)
    await deleteRaw()
    const msg =
      err instanceof Error && err.message.includes("compress")
        ? err.message
        : "Could not read that image. Try another file or export as JPG or PNG."
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const dest = `samples/${user.id}/${nanoid()}.jpg`
  const outMime = "image/jpeg"

  let url: string
  try {
    const result = await fileStore.upload(dest, jpegBuffer, outMime)
    url = result.url
  } catch (err) {
    console.error("[headshot-upload] fileStore.upload failed:", err)
    await deleteRaw()
    return NextResponse.json({ error: "Storage upload failed. Please try again." }, { status: 500 })
  }

  await deleteRaw()

  const absoluteUrl = url.startsWith("http") ? url : `${new URL(req.url).origin}${url}`
  return NextResponse.json({ url: absoluteUrl })
}

const DeleteBodySchema = z.object({
  url: z.string().min(1),
})

export async function DELETE(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = DeleteBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { url: urlStr } = parsed.data
  if (!userOwnsSampleUploadUrl(urlStr, user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const absoluteUrl = urlStr.startsWith("http") ? urlStr : `${new URL(req.url).origin}${urlStr}`
  const fileStore = getFileStore()
  try {
    await fileStore.delete(absoluteUrl)
  } catch (err) {
    if (err instanceof BlobNotFoundError) return new NextResponse(null, { status: 204 })
    console.error("[headshot-upload] delete failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
