import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { isGenerationConfigError } from "@/lib/generation/errors"
import { isLikelyUpstreamRateLimit, notifyOpsRateLimitEvent } from "@/lib/ops/rate-limit-alert"

const UPSTREAM_BUSY_MESSAGE =
  "Our AI providers are temporarily at capacity (rate limit). Please wait a few minutes and try again."

/** Log full error server-side; return a stable reference for support tickets. */
export function logGenerationFailure(
  scope: string,
  err: unknown,
  logContext?: Record<string, string>
): string {
  const ref = randomUUID()
  const suffix =
    logContext && Object.keys(logContext).length > 0
      ? ` ${Object.entries(logContext)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : ""
  console.error(`[${scope}] ref=${ref}${suffix}`, err)
  return ref
}

export function jsonGenerationErrorResponse(
  scope: string,
  err: unknown,
  status = 500,
  logContext?: Record<string, string>
): NextResponse {
  const ref = logGenerationFailure(scope, err, logContext)
  if (isGenerationConfigError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, ref },
      { status: 503 }
    )
  }
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
