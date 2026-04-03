/**
 * Downloads ElevenLabs preview audio for every active voice preset and saves
 * them as static MP3 files under public/voice-presets/previews/<presetId>.mp3
 *
 * Run once (and again whenever voice IDs change):
 *   node --env-file=.env.local scripts/download-voice-previews.mjs
 *
 * Requires Node ≥ 20.6 (for --env-file) and ELEVENLABS_API_KEY in .env.local.
 * After running, commit the generated files so they deploy with the app.
 */

import { writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, "..", "public", "voice-presets", "previews")
const BASE_URL = (process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io").replace(/\/$/, "")
const API_KEY = process.env.ELEVENLABS_API_KEY?.trim()
const MODEL = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5"
const FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128"
const PREVIEW_LINE = "Hi — this is a quick preview so you can hear this voice before you choose it."

const PRESET_IDS = [
  "rw-chris", "rw-stacy", "rw-billy", "rw-susan", "rw-vladimir", "rw-tatianna",
  "rw-antonio", "rw-larauque", "rw-chloe",
  "rb-demarcus", "rb-tonya", "rb-derrick", "rb-ms-harris", "rb-ayinde", "rb-ololade",
  "ra-jay", "ra-ziyu", "ra-asakura",
  "ri-rahul", "ri-anika", "ri-kumaran",
  "rh-isaac", "rh-maria", "rh-elio", "rh-luis",
  "rme-mohammed", "rme-salma", "rme-burak",
  "job-farmer", "job-it-guy", "job-crypto-guy", "job-billionaire", "job-lawyer", "job-doctor",
  "tone-angry", "tone-crying", "tone-joyful", "tone-sarcastic", "tone-deadpan", "tone-whisper",
]

function envKeyFromPresetId(id) {
  return `VOICE_PRESET_${id.replace(/-/g, "_").toUpperCase()}_PROVIDER_ID`
}

const CDN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "*/*",
}

async function getVoicePreviewUrl(voiceId) {
  // Try v2 voices list first (returns richer data)
  const v2 = await fetch(
    `${BASE_URL}/v2/voices?voice_ids=${encodeURIComponent(voiceId)}&page_size=1`,
    { headers: { "xi-api-key": API_KEY } }
  )
  if (v2.ok) {
    const j = await v2.json()
    const voices = j.voices ?? []
    const match = voices.find(v => v.voice_id === voiceId) ?? voices[0]
    if (match?.preview_url) return match.preview_url
    for (const vl of match?.verified_languages ?? []) {
      if (vl.preview_url) return vl.preview_url
    }
  }

  // Fallback to v1 single voice
  const v1 = await fetch(`${BASE_URL}/v1/voices/${encodeURIComponent(voiceId)}`, {
    headers: { "xi-api-key": API_KEY },
  })
  if (v1.ok) {
    const j = await v1.json()
    if (j.preview_url) return j.preview_url
    for (const vl of j.verified_languages ?? []) {
      if (vl.preview_url) return vl.preview_url
    }
  }

  return null
}

async function downloadCdnPreview(previewUrl) {
  const res = await fetch(previewUrl, { headers: CDN_HEADERS })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.length > 0 ? buf : null
}

async function generateTtsPreview(voiceId) {
  const url = `${BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${FORMAT}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: PREVIEW_LINE, model_id: MODEL }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`TTS failed (${res.status}): ${err.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function downloadPreviewForVoice(presetId, voiceId) {
  // 1. Try ElevenLabs CDN preview (exact audio EL provides per voice)
  try {
    const cdnUrl = await getVoicePreviewUrl(voiceId)
    if (cdnUrl) {
      const bytes = await downloadCdnPreview(cdnUrl)
      if (bytes) return { bytes, source: "cdn" }
    }
  } catch {
    // fall through
  }

  // 2. Fallback: synthesise the standard preview line
  const bytes = await generateTtsPreview(voiceId)
  return { bytes, source: "tts" }
}

async function main() {
  if (!API_KEY) {
    console.error("❌  ELEVENLABS_API_KEY not set. Run with: node --env-file=.env.local scripts/download-voice-previews.mjs")
    process.exit(1)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  const results = { ok: [], skipped: [], failed: [] }

  for (const presetId of PRESET_IDS) {
    const voiceId = process.env[envKeyFromPresetId(presetId)]?.trim()
    const outPath = path.join(OUTPUT_DIR, `${presetId}.mp3`)

    if (!voiceId) {
      console.log(`⏭  ${presetId} — env var not set, skipping`)
      results.skipped.push(presetId)
      continue
    }

    process.stdout.write(`⬇  ${presetId} (${voiceId.slice(0, 8)}…) `)
    try {
      const { bytes, source } = await downloadPreviewForVoice(presetId, voiceId)
      await writeFile(outPath, bytes)
      console.log(`✅  saved ${Math.round(bytes.length / 1024)}KB [${source}]`)
      results.ok.push(presetId)
    } catch (err) {
      console.log(`❌  ${err.message}`)
      results.failed.push(presetId)
    }

    // Be polite to the ElevenLabs API
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone: ${results.ok.length} saved, ${results.skipped.length} skipped, ${results.failed.length} failed`)
  if (results.failed.length > 0) {
    console.log("Failed:", results.failed.join(", "))
    process.exit(1)
  }
}

main()
