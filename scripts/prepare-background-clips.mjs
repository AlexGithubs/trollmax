/**
 * Extracts ~1 min background clips from manual-background-sources/.
 * Preserves native aspect ratio (split-screen bottom half).
 *
 * Drop source files in manual-background-sources/ (see MANUAL_FILES below).
 *
 * Produces:
 *   modal/assets/{category}/clip-{n}.mp4
 *   public/video-backgrounds/previews/{category}/{n}.mp4
 *
 * Run: npm run prepare-backgrounds
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const SOURCE_DIR = path.join(ROOT, "manual-background-sources")
const MODAL_ASSETS = path.join(ROOT, "modal", "assets")
const PREVIEW_DIR = path.join(ROOT, "public", "video-backgrounds", "previews")

const CLIP_COUNT = 4
const CLIP_DURATION_SEC = 55
const PREVIEW_DURATION_SEC = 12

/** source filename in manual-background-sources/ */
const CATEGORY_SOURCES = {
  minecraft: [
    { file: "minecraft.mp4", startRatio: 0.05 },
    { file: "minecraft.mp4", startRatio: 0.28 },
    { file: "minecraft.mp4", startRatio: 0.52 },
    { file: "minecraft.mp4", startRatio: 0.76 },
  ],
  "subway-surfers": [
    { file: "subway-surfers-1.mp4", startRatio: 0.08 },
    { file: "subway-surfers-1.mp4", startRatio: 0.45 },
    { file: "subway-surfers-2.mp4", startRatio: 0.08 },
    { file: "subway-surfers-2.mp4", startRatio: 0.45 },
  ],
  "gta-ramp": [
    { file: "gta-ramp.mp4", startRatio: 0.05 },
    { file: "gta-ramp.mp4", startRatio: 0.28 },
    { file: "gta-ramp.mp4", startRatio: 0.52 },
    { file: "gta-ramp.mp4", startRatio: 0.76 },
  ],
  roblox: [
    { file: "roblox-1.mp4", startRatio: 0.08 },
    { file: "roblox-1.mp4", startRatio: 0.45 },
    { file: "roblox-2.mp4", startRatio: 0.08 },
    { file: "roblox-2.mp4", startRatio: 0.45 },
  ],
  satisfying: [
    { file: "satisfying.mp4", startRatio: 0.1 },
    { file: "satisfying.mp4", startRatio: 0.28 },
    { file: "satisfying.mp4", startRatio: 0.52 },
    { file: "satisfying.mp4", startRatio: 0.76 },
  ],
}

function resolveFfmpeg() {
  try {
    const staticPath = require("ffmpeg-static")
    if (staticPath && existsSync(staticPath)) return staticPath
  } catch {
    // ignore
  }
  return "ffmpeg"
}

/** ffmpeg-static bundles ffmpeg only — parse Duration from stderr. */
function videoDurationSec(filePath) {
  const ffmpeg = resolveFfmpeg()
  const result = spawnSync(ffmpeg, ["-i", filePath], { encoding: "utf8" })
  const match = result.stderr?.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
  if (!match) return 0
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const s = parseFloat(match[3])
  return h * 3600 + m * 60 + s
}

function runFfmpeg(args) {
  const ffmpeg = resolveFfmpeg()
  const result = spawnSync(ffmpeg, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr?.slice(-500) ?? "unknown"}`)
  }
}

function extractClip(inputPath, outputPath, startSec) {
  runFfmpeg([
    "-y",
    "-ss",
    String(Math.max(0, startSec)),
    "-i",
    inputPath,
    "-t",
    String(CLIP_DURATION_SEC),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-an",
    "-movflags",
    "+faststart",
    outputPath,
  ])
}

/** Match Modal half-layout bottom: fill 9:8 (1080×960), center-crop, then scale for web. */
function makePreview(inputPath, outputPath) {
  runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-t",
    String(PREVIEW_DURATION_SEC),
    "-vf",
    "scale=1080:960:force_original_aspect_ratio=increase,"
    + "crop=1080:960:(iw-1080)/2:(ih-960)/2,"
    + "scale=540:480:flags=lanczos,fps=24",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "26",
    "-an",
    "-movflags",
    "+faststart",
    outputPath,
  ])
}

function statSize(p) {
  try {
    return statSync(p).size
  } catch {
    return 0
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

function sourcePath(filename) {
  const p = path.join(SOURCE_DIR, filename)
  if (!existsSync(p)) {
    throw new Error(`missing source: manual-background-sources/${filename}`)
  }
  return p
}

async function regeneratePreviewsOnly(category) {
  const categoryDir = path.join(MODAL_ASSETS, category)
  const previewCategoryDir = path.join(PREVIEW_DIR, category)
  mkdirSync(previewCategoryDir, { recursive: true })

  for (let n = 1; n <= CLIP_COUNT; n++) {
    const modalOut = path.join(categoryDir, `clip-${n}.mp4`)
    const previewOut = path.join(previewCategoryDir, `${n}.mp4`)
    if (!existsSync(modalOut) || statSize(modalOut) < 10_000) {
      throw new Error(`missing ${modalOut}`)
    }
    process.stdout.write(`  preview-${n} `)
    makePreview(modalOut, previewOut)
    console.log(`✅ ${Math.round(statSize(previewOut) / 1024)}KB`)
  }
}

async function processCategory(category) {
  const specs = CATEGORY_SOURCES[category]
  const categoryDir = path.join(MODAL_ASSETS, category)
  const previewCategoryDir = path.join(PREVIEW_DIR, category)
  mkdirSync(categoryDir, { recursive: true })
  mkdirSync(previewCategoryDir, { recursive: true })

  const durationCache = new Map()

  function getDuration(file) {
    if (!durationCache.has(file)) {
      const p = sourcePath(file)
      const dur = videoDurationSec(p)
      durationCache.set(file, dur)
      console.log(`    ${file} — ${Math.round(dur)}s`)
    }
    return durationCache.get(file)
  }

  for (let i = 0; i < CLIP_COUNT; i++) {
    const n = i + 1
    const spec = specs[i]
    const input = sourcePath(spec.file)
    const duration = getDuration(spec.file)
    if (duration <= CLIP_DURATION_SEC + 10) {
      throw new Error(`${spec.file}: could not read duration (got ${duration}s)`)
    }
    const maxStart = Math.max(0, duration - CLIP_DURATION_SEC - 5)
    const startSec = Math.min(maxStart, duration * spec.startRatio)

    const modalOut = path.join(categoryDir, `clip-${n}.mp4`)
    const previewOut = path.join(previewCategoryDir, `${n}.mp4`)

    process.stdout.write(
      `  clip-${n} @ ${formatTime(startSec)} / ${formatTime(duration)} from ${spec.file} `
    )
    extractClip(input, modalOut, startSec)
    makePreview(modalOut, previewOut)
    console.log(`✅ ${Math.round(statSize(modalOut) / 1024)}KB`)
  }
}

async function main() {
  const previewsOnly = process.argv.includes("--previews-only")
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  const allCategories = Object.keys(CATEGORY_SOURCES)
  const toRun =
    args.length > 0 ? allCategories.filter((c) => args.includes(c)) : allCategories

  if (!previewsOnly && !existsSync(SOURCE_DIR)) {
    console.error(`❌ Create ${SOURCE_DIR} and add source MP4s`)
    process.exit(1)
  }

  const results = { ok: [], failed: [] }

  for (const category of toRun) {
    console.log(`\n📁 ${category}${previewsOnly ? " (previews)" : ""}`)
    try {
      if (previewsOnly) await regeneratePreviewsOnly(category)
      else await processCategory(category)
      results.ok.push(category)
    } catch (err) {
      console.log(`❌ ${err.message}`)
      results.failed.push(category)
    }
  }

  console.log(`\nDone: ${results.ok.length} OK, ${results.failed.length} failed`)
  if (results.failed.length > 0) process.exit(1)
}

main()
