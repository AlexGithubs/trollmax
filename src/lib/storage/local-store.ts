/**
 * Local file store for development.
 * Saves files to OS temp dir and serves them through /api/dev-assets.
 * Never used in production (only when BLOB_READ_WRITE_TOKEN is absent).
 */
import fs from "fs"
import path from "path"
import type { FileStore } from "./types"

const DEV_ASSETS_DIR = path.join(process.cwd(), ".dev-assets")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export class LocalFileStore implements FileStore {
  async upload(
    filePath: string,
    buffer: Buffer,
    _contentType: string,
    _access?: "public" | "private"
  ): Promise<{ url: string }> {
    ensureDir(DEV_ASSETS_DIR)
    // Flatten path separators so clips/abc.wav becomes clips-abc.wav
    const safeName = filePath.replace(/\//g, "-")
    const dest = path.join(DEV_ASSETS_DIR, safeName)
    fs.writeFileSync(dest, buffer)
    return { url: `/api/dev-assets/${safeName}` }
  }

  async delete(url: string): Promise<void> {
    const m = url.match(/\/api\/dev-assets\/([^?#]+)/)
    if (!m) return
    const safeName = decodeURIComponent(m[1])
    if (safeName.includes("/") || safeName.includes("\\") || safeName.includes("..")) return
    const dest = path.join(DEV_ASSETS_DIR, safeName)
    const base = path.resolve(DEV_ASSETS_DIR)
    const resolved = path.resolve(dest)
    if (!resolved.startsWith(base + path.sep) && resolved !== base) return
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved)
  }
}
