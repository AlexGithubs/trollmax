// ── Manifest Store ────────────────────────────────────────────────────────────
// Key-value store for JSON manifests (soundboards, videos, takedowns, etc.)

export interface ManifestStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  del(key: string): Promise<void>
  /** Returns all members of a set */
  smembers(key: string): Promise<string[]>
  /** Adds members to a set */
  sadd(key: string, ...members: string[]): Promise<void>
  /** Removes a member from a set */
  srem(key: string, member: string): Promise<void>
  /**
   * Atomically subtract `amount` from the numeric string at `key` if the balance is sufficient.
   * If the key is missing, treat the current balance as `defaultIfMissing`.
   */
  tryDecrementNumeric?(
    key: string,
    amount: number,
    defaultIfMissing: number
  ): Promise<{ ok: true; balance: number } | { ok: false; balance: number }>
  /**
   * Set `key` to "1" only if it does not already exist (Redis SET NX).
   * Returns `true` if the key was created (lock acquired), `false` if it already existed.
   * The key expires automatically after `ttlSeconds`.
   */
  setNX?(key: string, ttlSeconds: number): Promise<boolean>
  /**
   * Atomically add `amount` to the numeric string at `key`, capped at `maxBalance`.
   * If the key is missing, treat the current balance as `defaultIfMissing`.
   * Returns the new balance.
   */
  incrementNumeric?(
    key: string,
    amount: number,
    defaultIfMissing: number,
    maxBalance: number
  ): Promise<number>
}

// ── File Store ────────────────────────────────────────────────────────────────
// Binary blob storage for audio and video files

export interface FileStore {
  upload(
    path: string,
    buffer: Buffer,
    contentType: string,
    access?: "public" | "private"
  ): Promise<{ url: string }>
  /** Remove a file previously returned from upload (URL must be owned by the caller). */
  delete(url: string): Promise<void>
}
