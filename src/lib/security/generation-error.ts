import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { isLikelyUpstreamRateLimit, notifyOpsRateLimitEvent } from "@/lib/ops/rate-limit-alert"

const UPSTREAM_BUSY_MESSAGE =
  "Our AI providers are temporarily at capacity (rate limit). Please wait a few minutes and try again."

/** Log full error server-side; return a stable reference for support tickets. */
export function logGenerationFailure(scope: string, err: unknown): string {
  const ref = randomUUID()
  console.error(`[${scope}] ref=${ref}`, err)
  return ref
}

export function jsonGenerationErrorResponse(
  scope: string,
  err: unknown,
  status = 500
): NextResponse {
  const ref = logGenerationFailure(scope, err)
  if (isLikelyUpstreamRateLimit(err)) {
    notifyOpsRateLimitEvent({
      kind: "upstream",
      source: scope,
      detail: `${err instanceof Error ? err.message : String(err)} (ref=${ref})`,
    })
    return NextResponse.json(
      {
        error: UPSTREAM_BUSY_MESSAGE,
        code: "UPSTREAM_RATE_LIMIT",
        ref,
      },
      { status: 503 }
    )
  }
  return NextResponse.json(
    {
      error: "Generation failed. Please try again or contact support.",
      ref,
    },
    { status }
  )
}
