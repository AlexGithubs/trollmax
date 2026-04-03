/**
 * Emails the operator when app or upstream APIs hit rate limits.
 * Configure: RESEND_API_KEY + TROLLMAX_OPS_ALERT_EMAIL (and optional TROLLMAX_OPS_ALERT_FROM).
 * Cooldown uses Upstash when available so you get at most one email per source per hour.
 */

const COOLDOWN_SEC = 60 * 60

const memCooldown = new Map<string, number>()

function hourBucket(): string {
  return new Date().toISOString().slice(0, 13)
}

function pruneMemCooldown(now: number) {
  for (const [k, exp] of memCooldown) {
    if (exp <= now) memCooldown.delete(k)
  }
}

async function shouldSendAlert(dedupeKey: string): Promise<boolean> {
  const fullKey = `ops:rlnotify:${dedupeKey}`

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.NEXT_PUBLIC_MOCK_MODE !== "true"
  ) {
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: false,
    })
    const set = await redis.set(fullKey, "1", { ex: COOLDOWN_SEC, nx: true })
    return set === "OK"
  }

  const now = Date.now()
  pruneMemCooldown(now)
  const exp = memCooldown.get(fullKey)
  if (exp && exp > now) return false
  memCooldown.set(fullKey, now + COOLDOWN_SEC * 1000)
  return true
}

export function isLikelyUpstreamRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const s = msg.toLowerCase()
  if (/\b429\b/.test(msg)) return true
  if (s.includes("rate limit") || s.includes("too many requests")) return true
  if (s.includes("throttl")) return true
  if ((s.includes("quota") || s.includes("credit")) && (s.includes("exceed") || s.includes("exhausted"))) {
    return true
  }
  return false
}

/**
 * Fire-and-forget email via Resend. Safe to call without awaiting in request handlers.
 */
export function notifyOpsRateLimitEvent(args: {
  kind: "app" | "upstream"
  /** Short id, e.g. "generate", "upload", "d-id", "elevenlabs" */
  source: string
  detail: string
  userId?: string
}): void {
  const dedupeKey = `${args.kind}:${args.source}:${hourBucket()}`
  void (async () => {
    try {
      const ok = await shouldSendAlert(dedupeKey)
      if (!ok) return

      const to = process.env.TROLLMAX_OPS_ALERT_EMAIL?.trim()
      const apiKey = process.env.RESEND_API_KEY?.trim()
      if (!to || !apiKey) {
        console.warn(
          `[ops] Rate limit (${args.kind}/${args.source}): ${args.detail}` +
            (to ? "" : " — set TROLLMAX_OPS_ALERT_EMAIL to receive email alerts.")
        )
        return
      }

      const from =
        process.env.TROLLMAX_OPS_ALERT_FROM?.trim() || "Trollmax <onboarding@resend.dev>"
      const subject =
        args.kind === "app"
          ? `[Trollmax] App rate limit (${args.source})`
          : `[Trollmax] Upstream rate limit (${args.source})`

      const lines = [
        subject,
        "",
        `Kind: ${args.kind}`,
        `Source: ${args.source}`,
        args.userId ? `User: ${args.userId}` : "",
        "",
        "Detail:",
        args.detail.slice(0, 8000),
        "",
        `Time: ${new Date().toISOString()}`,
      ].filter(Boolean)

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: lines.join("\n"),
        }),
      })

      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText)
        console.error("[ops] Resend failed:", res.status, t.slice(0, 500))
      }
    } catch (e) {
      console.error("[ops] notifyOpsRateLimitEvent error:", e)
    }
  })()
}

export function notifyAppRateLimitHit(
  userId: string,
  action: "upload" | "generate" | "create"
): void {
  notifyOpsRateLimitEvent({
    kind: "app",
    source: action,
    detail: `A user hit the per-hour ${action} cap (Upstash-backed rate limiter).`,
    userId,
  })
}
