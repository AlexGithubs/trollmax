import ffmpeg from "fluent-ffmpeg"
import ffmpegStatic from "ffmpeg-static"
import { mkdtemp, readFile, rm, writeFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

if (typeof ffmpegStatic === "string" && ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

/**
 * Demux + encode first audio stream to mono MP3 (44.1kHz, ~128k).
 */
export async function extractAudioFromVideoToMp3(
  inputBuffer: Buffer,
  /** Extension with dot, e.g. `.mp4` — helps ffmpeg choose demuxer */
  inputExtWithDot: string
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "trollmax-v2a-"))
  const inPath = join(dir, `input${inputExtWithDot}`)
  const outPath = join(dir, "audio-out.mp3")
  try {
    await writeFile(inPath, inputBuffer)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .outputOptions(["-vn", "-map", "0:a:0"])
        .audioChannels(1)
        .audioFrequency(44100)
        .audioBitrate("128k")
        .audioCodec("libmp3lame")
        .format("mp3")
        .on("end", () => resolve())
        .on("error", (err, _stdout, stderr) => {
          const detail = stderr?.trim() || err.message
          reject(
            new Error(
              detail.includes("Output file does not contain any stream")
                ? "No audio track found in that video."
                : "Could not read audio from that file. Try a different format or re-export the video."
            )
          )
        })
        .save(outPath)
    })
    return await readFile(outPath)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
