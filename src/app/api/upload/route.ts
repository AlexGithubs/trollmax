export const runtime = "nodejs"

import { BlobNotFoundError } from "@vercel/blob"
import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { parseBlob } from "music-metadata"
import { nanoid } from "nanoid"
import { getBlobPutAccess } from "@/lib/storage/blob-env-sync"
import { getFileStore } from "@/lib/storage"
import { userOwnsSampleUploadUrl } from "@/lib/storage/sample-upload-url"
import { checkRateLimit } from "@/lib/rate-limit"
import { extractAudioFromVideoToMp3 } from "@/lib/media/extract-audio-from-video"
import { z } from "zod"

const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

// Fallback MIME when browser sends empty type (common for .m4a on macOS/iOS)
const EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  wave: "audio/wav",
  webm: "video/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  opus: "audio/opus",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  ogv: "video/ogg",
}

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/opus": "opus",
  "audio/3gpp": "3gp",
  "audio/3gpp2": "3g2",
}

const VIDEO_EXT = new Set([
  "mp4",
  "m4v",
  "mov",
  "qt",
  "webm",
  "mkv",
  "avi",
  "wmv",
  "ogv",
  "3gp",
  "3g2",
])

function videoExtWithDot(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp4"
  const safe = VIDEO_EXT.has(ext) ? ext : "mp4"
  return `.${safe}`
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "upload")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const fileAsFile = file as File
  const fileName = fileAsFile.name ?? ""
  const fileExt = fileName.split(".").pop()?.toLowerCase() ?? ""

  let mimeType = file.type.split(";")[0].trim().toLowerCase()
  if (!mimeType) {
    mimeType = EXT_TO_MIME[fileExt] ?? ""
  }

  const audioMp4VideoContainer =
    mimeType === "audio/mp4" && (fileExt === "mp4" || fileExt === "m4v")
  const isExplicitAudio = mimeType.startsWith("audio/") && !audioMp4VideoContainer
  const isVideo =
    mimeType.startsWith("video/") ||
    audioMp4VideoContainer ||
    (!isExplicitAudio && VIDEO_EXT.has(fileExt))

  if (isVideo) {
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: `Video too large (max ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB).` },
        { status: 400 }
      )
    }
  } else if (mimeType.startsWith("audio/")) {
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MB)` },
        { status: 400 }
      )
    }
  } else {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Upload audio (mp3, wav, m4a, …) or a video (mp4, mov, webm, …) with an audio track.",
      },
      { status: 400 }
    )
  }

  let buffer = Buffer.from(await file.arrayBuffer())
  let storeMime = mimeType
  let storeExt = MIME_TO_EXT[mimeType] ?? (mimeType.startsWith("video/") ? "mp4" : "bin")

  if (isVideo) {
    try {
      buffer = Buffer.from(await extractAudioFromVideoToMp3(buffer, videoExtWithDot(fileName)))
      storeMime = "audio/mpeg"
      storeExt = "mp3"
    } catch (err) {
      console.error("[upload] video extract failed:", err)
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not extract audio from that video.",
        },
        { status: 400 }
      )
    }
    if (buffer.length > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Extracted audio is too large. Try a shorter clip or lower-quality video." },
        { status: 400 }
      )
    }
  }

  let durationSeconds: number
  try {
    const metadata = await parseBlob(new Blob([buffer], { type: storeMime }))
    durationSeconds = metadata.format.duration ?? 0
  } catch {
    return NextResponse.json({ error: "Could not read audio file" }, { status: 400 })
  }

  if (durationSeconds < 6) {
    return NextResponse.json(
      { error: `Audio too short (${durationSeconds.toFixed(1)}s). Minimum is 6 seconds.` },
      { status: 400 }
    )
  }
  if (durationSeconds > 60) {
    return NextResponse.json(
      { error: `Audio too long (${durationSeconds.toFixed(1)}s). Maximum is 60 seconds.` },
      { status: 400 }
    )
  }

  const fileStore = getFileStore()
  let url: string
  try {
    const result = await fileStore.upload(
      `samples/${user.id}/${nanoid()}.${storeExt}`,
      buffer,
      storeMime,
      getBlobPutAccess()
    )
    url = result.url
  } catch (err) {
    console.error("[upload] fileStore.upload failed:", err)
    return NextResponse.json({ error: "Storage upload failed. Please try again." }, { status: 500 })
  }

  const absoluteUrl = url.startsWith("http") ? url : `${new URL(req.url).origin}${url}`
  return NextResponse.json({ url: absoluteUrl, durationSeconds })
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
    if (err instanceof BlobNotFoundError) {
      return new NextResponse(null, { status: 204 })
    }
    console.error("[upload] delete failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
