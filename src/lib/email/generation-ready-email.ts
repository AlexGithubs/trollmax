/**
 * User-facing email when a video or soundboard finishes generating.
 * Configure: RESEND_API_KEY + TROLLMAX_USER_EMAIL_FROM (or TROLLMAX_OPS_ALERT_FROM).
 */

import { getSiteBaseUrl } from "@/lib/site-url"

const COOLDOWN_SEC = 24 * 60 * 60

const memCooldown = new Map<string, number>()

function pruneMemCooldown(now: number) {
  for (const [k, exp] of memCooldown) {
    if (exp <= now) memCooldown.delete(k)
  }
}

async function shouldSendEmail(dedupeKey: string): Promise<boolean> {
  const fullKey = `notify:gen:${dedupeKey}`

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

function emailFromAddress(): string | null {
  return (
    process.env.TROLLMAX_USER_EMAIL_FROM?.trim() ||
    process.env.TROLLMAX_OPS_ALERT_FROM?.trim() ||
    null
  )
}

export function getUserEmailFromClerkUser(user: {
  primaryEmailAddress?: { emailAddress?: string } | null
  emailAddresses?: { emailAddress?: string }[]
}): string | null {
  const primary = user.primaryEmailAddress?.emailAddress?.trim()
  if (primary) return primary
  for (const entry of user.emailAddresses ?? []) {
    const addr = entry.emailAddress?.trim()
    if (addr) return addr
  }
  return null
}

/**
 * Fire-and-forget email via Resend. Safe to call without awaiting in request handlers.
 */
export function notifyGenerationReady(args: {
  to: string
  product: "video" | "soundboard"
  title: string
  manifestId: string
  outcome: "complete" | "failed"
  errorMessage?: string
}): void {
  const dedupeKey = `${args.product}:${args.manifestId}:${args.outcome}`
  void (async () => {
    try {
      const ok = await shouldSendEmail(dedupeKey)
      if (!ok) return

      const apiKey = process.env.RESEND_API_KEY?.trim()
      if (!apiKey) {
        console.warn(
          `[email] Generation ${args.outcome} for ${args.product}/${args.manifestId} — set RESEND_API_KEY to notify users.`
        )
        return
      }

      const from = emailFromAddress() || "Trollmax <onboarding@resend.dev>"
      const base = getSiteBaseUrl() ?? "http://localhost:3000"
      const path =
        args.product === "video"
          ? `/app/video/${args.manifestId}`
          : `/app/soundboard/${args.manifestId}`
      const viewUrl = `${base}${path}`
      const label = args.product === "video" ? "video" : "soundboard"

      const subject =
        args.outcome === "complete"
          ? `Your ${label} "${args.title}" is ready`
          : `Your ${label} "${args.title}" could not be generated`

      const lines =
        args.outcome === "complete"
          ? [
              `Hi — your ${label} "${args.title}" is ready to watch and share.`,
              "",
              `Open it here: ${viewUrl}`,
              "",
              "— Trollmax",
            ]
          : [
              `Hi — we couldn't finish your ${label} "${args.title}".`,
              "",
              args.errorMessage ? `Reason: ${args.errorMessage.slice(0, 500)}` : "",
              "",
              `You can try again here: ${viewUrl}`,
              "",
              "— Trollmax",
            ].filter(Boolean)

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [args.to],
          subject,
          text: lines.join("\n"),
        }),
      })

      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText)
        console.error("[email] Resend failed:", res.status, t.slice(0, 500))
      }
    } catch (e) {
      console.error("[email] notifyGenerationReady error:", e)
    }
  })()
}
