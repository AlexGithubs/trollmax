import ffmpeg from "fluent-ffmpeg"
import ffmpegStatic from "ffmpeg-static"
import sharp from "sharp"
import { mkdtemp, readFile, rm, writeFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

if (typeof ffmpegStatic === "string" && ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

const OG_WIDTH = 1200
const OG_HEIGHT = 630

/**
 * Extract a single frame from an MP4 buffer and produce a JPEG suitable for Open Graph (1200×630 cover crop).
 */
export async function extractOgPosterJpegFromMp4(mp4Buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "trollmax-poster-"))
  const inPath = join(dir, "input.mp4")
  const rawJpegPath = join(dir, "frame.jpg")
  try {
    await writeFile(inPath, mp4Buffer)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .seekInput(0.5)
        .outputOptions(["-vframes", "1", "-q:v", "3"])
        .format("image2")
        .on("end", () => resolve())
        .on("error", (err, _stdout, stderr) => {
          const detail = stderr?.trim() || err.message
          reject(new Error(detail || "ffmpeg poster extraction failed"))
        })
        .save(rawJpegPath)
    })
    const raw = await readFile(rawJpegPath)
    return await sharp(raw)
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer()
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
