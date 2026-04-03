/**
 * Validates env vars that must be present for real generation/storage on Vercel.
 * Mock mode skips checks (local / tests).
 */

export type ProductionDepsCheck = {
  ok: boolean
  issues: string[]
}

export function shouldEnforceProductionDeps(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_MOCK_MODE !== "true"
}

export function getProductionDependencyIssues(): ProductionDepsCheck {
  const issues: string[] = []
  if (process.env.NEXT_PUBLIC_MOCK_MODE === "true") {
    return { ok: true, issues: [] }
  }
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    issues.push("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    issues.push(
      "Missing BLOB_READ_WRITE_TOKEN (TTS clip uploads and private voice samples require Vercel Blob)"
    )
  }
  return { ok: issues.length === 0, issues }
}
