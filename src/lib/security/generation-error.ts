import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import {
  isGenerationConfigError,
  isGenerationUserInputError,
} from "@/lib/generation/errors"
import { isLikelyUpstreamRateLimit, notifyOpsRateLimitEvent } from "@/lib/ops/rate-limit-alert"

const UPSTREAM_BUSY_MESSAGE =
  "Our AI providers are temporarily at capacity (rate limit). Please wait a few minutes and try again."

/** Log full error server-side (Vercel / Node stdout — not the browser console). */
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
  const head = `[${scope}] ref=${ref}${suffix}`
  if (err instanceof Error) {
    console.error(`${head} message=${err.message}`)
    if (err.stack) console.error(`${head} stack:\n${err.stack}`)
  } else {
    console.error(`${head} error=${String(err)}`)
  }
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
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err)
    return NextResponse.json(
      {
        error: msg,
        code: "GENERATION_CONFIG",
        ref,
      },
      { status: 503 }
    )
  }
  if (isGenerationUserInputError(err)) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err)
    return NextResponse.json(
      {
        error: msg,
        code: "GENERATION_USER_INPUT",
        ref,
      },
      { status: 422 }
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
  const detail =
    err instanceof Error
      ? err.message.slice(0, 500)
      : typeof err === "string"
        ? err.slice(0, 500)
        : undefined
  return NextResponse.json(
    {
      error: "Generation failed. Please try again or contact support.",
      ref,
      ...(detail ? { detail } : {}),
    },
    { status }
  )
}
