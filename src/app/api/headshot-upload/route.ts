export const runtime = "nodejs"

import { BlobNotFoundError } from "@vercel/blob"
import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { getFileStore } from "@/lib/storage"
import { userOwnsSampleUploadUrl } from "@/lib/storage/sample-upload-url"
import { checkRateLimit } from "@/lib/rate-limit"
import { normalizeHeadshotToJpeg } from "@/lib/media/normalize-headshot"
import { z } from "zod"

/** Raw uploads can be larger (HEIC, PNG); output JPEG is capped inside normalize. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

const IMAGE_LIKE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "avif",
  "jxl",
])

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

function looksLikeImage(file: File, mime: string): boolean {
  const m = mime.split(";")[0].trim().toLowerCase()
  if (m.startsWith("image/")) return true
  if (m === "application/octet-stream" || m === "" || m === "application/x-msdownload") {
    return IMAGE_LIKE_EXT.has(fileExt(file.name ?? ""))
  }
  // iOS sometimes uses non-standard types for HEIC
  if (m === "image/heic" || m === "image/heif" || m === "image/heic-sequence") return true
  return false
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "upload")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const ct = req.headers.get("content-type") ?? ""
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data (file upload)." },
      { status: 415 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Invalid or empty upload body. Try choosing the photo again." },
      { status: 400 }
    )
  }
  const file = formData.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ~25 MB before conversion). Try a smaller image.` },
      { status: 400 }
    )
  }

  const fileAsFile = file as File
  const rawMime = file.type?.split(";")[0].trim().toLowerCase() ?? ""
  if (!looksLikeImage(fileAsFile, rawMime)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a photo (e.g. JPG, PNG, WebP, HEIC, GIF)." },
      { status: 400 }
    )
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer())

  let jpegBuffer: Buffer
  try {
    jpegBuffer = await normalizeHeadshotToJpeg(inputBuffer)
  } catch (err) {
    console.error("[headshot-upload] normalize failed:", err)
    const msg =
      err instanceof Error && err.message.includes("compress")
        ? err.message
        : "Could not read that image. Try another file or export as JPG or PNG."
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const fileStore = getFileStore()
  const dest = `samples/${user.id}/${nanoid()}.jpg`
  const outMime = "image/jpeg"

  let url: string
  try {
    const result = await fileStore.upload(dest, jpegBuffer, outMime)
    url = result.url
  } catch (err) {
    console.error("[headshot-upload] fileStore.upload failed:", err)
    return NextResponse.json({ error: "Storage upload failed. Please try again." }, { status: 500 })
  }

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
