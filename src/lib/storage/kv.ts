/**
 * Upstash Redis adapter (REST).
 * Only used when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 */
import { Redis } from "@upstash/redis"
import type { ManifestStore } from "./types"

/** Atomic unconditional add for banana credit refunds (string-encoded decimals). */
const INCREMENT_NUMERIC_LUA = `
local key = KEYS[1]
local amount = tonumber(ARGV[1]) or 0
local defaultBal = tonumber(ARGV[2]) or 0
local maxBal = tonumber(ARGV[3]) or 99999
if amount < 0 then amount = 0 end
if defaultBal < 0 then defaultBal = 0 end
if maxBal < 0 then maxBal = 0 end
local raw = redis.call("GET", key)
local bal = defaultBal
if raw then
  local p = tonumber(raw)
  if p and p >= 0 then bal = p end
end
if bal < 0 then bal = 0 end
local newbal = bal + amount
if newbal > maxBal then newbal = maxBal end
newbal = math.floor(newbal * 100 + 0.5) / 100
redis.call("SET", key, tostring(newbal))
return newbal
`

/** Atomic check-and-subtract for banana credit balances (string-encoded decimals). */
const TRY_DECREMENT_NUMERIC_LUA = `
local key = KEYS[1]
local cost = tonumber(ARGV[1]) or 0
local defaultBal = tonumber(ARGV[2]) or 0
if cost < 0 then cost = 0 end
if defaultBal < 0 then defaultBal = 0 end
local raw = redis.call("GET", key)
local bal = defaultBal
if raw then
  local p = tonumber(raw)
  if p then bal = p end
end
if bal < 0 then bal = 0 end
if bal < cost then
  return {0, bal}
end
local newbal = bal - cost
newbal = math.floor(newbal * 100 + 0.5) / 100
redis.call("SET", key, tostring(newbal))
return {1, newbal}
`

export class VercelKVStore implements ManifestStore {
  private readonly redis: Redis

  constructor() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required")
    }
    // Important: disable auto JSON deserialization so stored JSON strings
    // round-trip as strings (callers do JSON.parse themselves).
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: false,
    })
  }

  async get(key: string): Promise<string | null> {
    const value = await this.redis.get(key)
    if (value == null) return null
    return typeof value === "string" ? value : JSON.stringify(value)
  }

  async tryDecrementNumeric(
    key: string,
    amount: number,
    defaultIfMissing: number
  ): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
    const cost = Math.max(0, Math.round(amount * 100) / 100)
    const def = Math.max(0, Math.round(defaultIfMissing * 100) / 100)
    const raw = (await this.redis.eval(
      TRY_DECREMENT_NUMERIC_LUA,
      [key],
      [String(cost), String(def)]
    )) as unknown
    const tuple = Array.isArray(raw) ? raw : null
    if (!tuple || tuple.length < 2) {
      throw new Error("tryDecrementNumeric: unexpected EVAL response")
    }
    const flag = Number(tuple[0])
    const bal = Number(tuple[1])
    if (!Number.isFinite(bal) || bal < 0) {
      throw new Error("tryDecrementNumeric: invalid balance in EVAL response")
    }
    if (flag === 1) {
      return { ok: true, balance: Math.round(bal * 100) / 100 }
    }
    return { ok: false, balance: Math.round(bal * 100) / 100 }
  }

  async incrementNumeric(
    key: string,
    amount: number,
    defaultIfMissing: number,
    maxBalance: number
  ): Promise<number> {
    const amt = Math.max(0, Math.round(amount * 100) / 100)
    const def = Math.max(0, Math.round(defaultIfMissing * 100) / 100)
    const max = Math.max(0, Math.round(maxBalance * 100) / 100)
    const raw = (await this.redis.eval(
      INCREMENT_NUMERIC_LUA,
      [key],
      [String(amt), String(def), String(max)]
    )) as unknown
    const val = Number(raw)
    if (!Number.isFinite(val) || val < 0) {
      throw new Error("incrementNumeric: unexpected EVAL response")
    }
    return Math.round(val * 100) / 100
  }

  async setNX(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, "1", { nx: true, ex: ttlSeconds })
    return result === "OK"
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value)
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async smembers(key: string): Promise<string[]> {
    const out = await this.redis.smembers<string[]>(key)
    return Array.isArray(out) ? out : []
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return
    // Avoid TS spread restrictions by handling arity explicitly.
    if (members.length === 1) {
      await this.redis.sadd(key, members[0]!)
      return
    }
    if (members.length === 2) {
      await this.redis.sadd(key, members[0]!, members[1]!)
      return
    }
    // Rare in this app, but support N members safely.
    await this.redis.sadd(key, members[0]!, members[1]!, ...members.slice(2))
  }

  async srem(key: string, member: string): Promise<void> {
    await this.redis.srem(key, member)
  }
}
