import type { ManifestStore, FileStore } from "./types"

// Use globalThis so maps survive Next.js Hot Module Replacement in dev mode
declare global {
  // eslint-disable-next-line no-var
  var __mockKvStore: Map<string, string> | undefined
  // eslint-disable-next-line no-var
  var __mockSetStore: Map<string, Set<string>> | undefined
}
const kvStore = (globalThis.__mockKvStore ??= new Map<string, string>())
const setStore = (globalThis.__mockSetStore ??= new Map<string, Set<string>>())

function roundCredits(n: number): number {
  return Math.max(0, Math.round(n * 100) / 100)
}

export class MockManifestStore implements ManifestStore {
  async get(key: string): Promise<string | null> {
    return kvStore.get(key) ?? null
  }

  async tryDecrementNumeric(
    key: string,
    amount: number,
    defaultIfMissing: number
  ): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
    const cost = roundCredits(amount)
    const raw = await this.get(key)
    const parsed = raw ? Number(raw) : Number.NaN
    const bal = Number.isFinite(parsed) ? Math.max(0, parsed) : roundCredits(defaultIfMissing)
    if (bal < cost - 1e-9) {
      return { ok: false, balance: bal }
    }
    const next = roundCredits(bal - cost)
    await this.set(key, String(next))
    return { ok: true, balance: next }
  }

  async incrementNumeric(
    key: string,
    amount: number,
    defaultIfMissing: number,
    maxBalance: number
  ): Promise<number> {
    const amt = roundCredits(amount)
    const raw = await this.get(key)
    const parsed = raw ? Number(raw) : Number.NaN
    const bal = Number.isFinite(parsed) && parsed >= 0 ? parsed : roundCredits(defaultIfMissing)
    const next = roundCredits(Math.min(bal + amt, maxBalance))
    await this.set(key, String(next))
    return next
  }

  async setNX(key: string, ttlSeconds: number): Promise<boolean> {
    if (kvStore.has(key)) return false
    kvStore.set(key, "1")
    setTimeout(() => kvStore.delete(key), ttlSeconds * 1000)
    return true
  }

  async set(key: string, value: string): Promise<void> {
    kvStore.set(key, value)
  }

  async del(key: string): Promise<void> {
    kvStore.delete(key)
    setStore.delete(key)
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(setStore.get(key) ?? [])
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!setStore.has(key)) setStore.set(key, new Set())
    const s = setStore.get(key)!
    for (const m of members) s.add(m)
  }

  async srem(key: string, member: string): Promise<void> {
    setStore.get(key)?.delete(member)
  }
}

/**
 * Mock file store — returns static public URLs instead of uploading.
 * In mock mode, audio synthesis always returns /mock-audio.mp3,
 * so binary upload is never actually needed.
 */
export class MockFileStore implements FileStore {
  async upload(
    _path: string,
    _buffer: Buffer,
    _contentType: string,
    _access?: "public" | "private"
  ): Promise<{ url: string }> {
    // In mock mode, callers use hardcoded static URLs; this is a no-op safety net
    return { url: "/mock-audio.mp3" }
  }

  async delete(_url: string): Promise<void> {
    // No persisted blobs in mock mode
  }
}
