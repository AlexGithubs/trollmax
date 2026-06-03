/**
 * Re-process all preset headshots for tighter D-ID-friendly framing (face-centered crop).
 * Run: npx tsx scripts/prepare-headshot-presets.ts
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { preparePresetHeadshotForDid } from "../src/lib/media/prepare-preset-headshot"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, "../public/headshots")

async function main() {
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  for (const file of files) {
    const p = path.join(dir, file)
    const raw = await readFile(p)
    const out = await preparePresetHeadshotForDid(raw)
    const outName = file.replace(/\.(png|webp)$/i, ".jpg")
    await writeFile(path.join(dir, outName), out)
    if (outName !== file) {
      const { unlink } = await import("node:fs/promises")
      await unlink(p).catch(() => {})
    }
    console.log(`OK ${outName} (${Math.round(out.length / 1024)} KB)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
