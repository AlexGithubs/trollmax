export type GenerationPollStatus = {
  status?: string
  progressStep?: string | null
  progressPct?: number | null
  progressDetail?: string | null
  lastError?: string | null
  lastErrorCode?: string | null
  bananaCreditsBalance?: number
}

export type InsufficientCreditsPayload = {
  balance: number
  required: number
}

export type StartGenerationResult =
  | { kind: "ok"; bananaCreditsBalance?: number }
  | { kind: "insufficient_credits"; payload: InsufficientCreditsPayload }
  | { kind: "network_error"; message: string }

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    err.name === "AbortError" ||
    err.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed")
  )
}

function isProcessingStatus(status: string | undefined): boolean {
  // NOTE: "draft" is intentionally NOT processing. The generate route flips the manifest
  // to "processing" synchronously before returning, so a manifest still stuck on "draft"
  // means generation never actually started (the POST failed or never reached the server).
  return status === "processing" || status === "queued"
}

/**
 * Kick off a long-running generate POST without blocking the UI on the response.
 * Network drops (common on mobile background) are recorded but not treated as fatal
 * while server-side generation continues.
 */
export function startGenerationPost(generateUrl: string): {
  promise: Promise<StartGenerationResult>
  getPostError: () => Error | null
  clearPostError: () => void
} {
  let postError: Error | null = null

  const promise = fetch(generateUrl, { method: "POST" })
    .then(async (r) => {
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (r.status === 402 && j.code === "INSUFFICIENT_BANANA_CREDITS") {
        return {
          kind: "insufficient_credits" as const,
          payload: {
            balance: typeof j.balance === "number" ? j.balance : 0,
            required: typeof j.required === "number" ? j.required : 0,
          },
        }
      }
      if (!r.ok) {
        const msg = [j.error, j.detail].filter(Boolean).join(" — ")
        throw new Error(typeof msg === "string" && msg ? msg : "Generation failed")
      }
      return {
        kind: "ok" as const,
        bananaCreditsBalance:
          typeof j.bananaCreditsBalance === "number" ? j.bananaCreditsBalance : undefined,
      }
    })
    .catch((err) => {
      if (isNetworkError(err)) {
        postError = err instanceof Error ? err : new Error(String(err))
        return { kind: "network_error" as const, message: postError.message }
      }
      throw err
    })

  return {
    promise,
    getPostError: () => postError,
    clearPostError: () => {
      postError = null
    },
  }
}

export async function pollUntilGenerationSettled(options: {
  statusUrl: string
  onProgress: (status: GenerationPollStatus) => void
  generatePromise?: Promise<StartGenerationResult>
  getPostError?: () => Error | null
  clearPostError?: () => void
  maxAttempts?: number
  intervalMs?: number
}): Promise<{
  outcome: "complete" | "failed" | "insufficient_credits" | "timeout"
  status: GenerationPollStatus
  bananaCreditsBalance?: number
  insufficientCredits?: InsufficientCreditsPayload
}> {
  const maxAttempts = options.maxAttempts ?? 900
  const intervalMs = options.intervalMs ?? 1000
  let lastStatus: GenerationPollStatus = {}
  let processingSeen = false
  let genResult: StartGenerationResult | undefined
  let genError: Error | null = null

  if (options.generatePromise) {
    options.generatePromise.then(
      (result) => {
        genResult = result
      },
      (err) => {
        // A non-network generate failure (e.g. 409/500) rejects here. Capture it so we can
        // surface it instead of polling a never-starting manifest until the timeout.
        genError = err instanceof Error ? err : new Error(String(err))
      }
    )
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (genResult?.kind === "insufficient_credits") {
      return {
        outcome: "insufficient_credits",
        status: lastStatus,
        insufficientCredits: genResult.payload,
      }
    }

    try {
      const statusRes = await fetch(options.statusUrl, { method: "GET" })
      const statusJson = (await statusRes.json().catch(() => null)) as GenerationPollStatus | null
      if (statusJson) {
        lastStatus = statusJson
        options.onProgress(statusJson)

        if (isProcessingStatus(statusJson.status)) {
          processingSeen = true
          options.clearPostError?.()
        }

        if (statusJson.status === "complete") {
          if (options.generatePromise && !genResult) {
            genResult = await options.generatePromise
          }
          if (genResult?.kind === "insufficient_credits") {
            return {
              outcome: "insufficient_credits",
              status: statusJson,
              insufficientCredits: genResult.payload,
            }
          }
          return {
            outcome: "complete",
            status: statusJson,
            bananaCreditsBalance:
              genResult?.kind === "ok" ? genResult.bananaCreditsBalance : undefined,
          }
        }

        if (statusJson.status === "failed") {
          await options.generatePromise?.catch(() => {})
          return { outcome: "failed", status: statusJson }
        }
      }
    } catch {
      // Status poll failed transiently — keep trying unless POST also failed with no processing seen.
    }

    // If the generate POST hard-failed and the manifest never reached "processing",
    // surface the real error promptly instead of hanging until the timeout.
    if (genError && !processingSeen && attempt >= 5) {
      throw genError
    }

    const postError = options.getPostError?.()
    if (postError && !processingSeen && attempt >= 8) {
      throw postError
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  if (genResult?.kind === "insufficient_credits") {
    return {
      outcome: "insufficient_credits",
      status: lastStatus,
      insufficientCredits: genResult.payload,
    }
  }

  await options.generatePromise?.catch(() => {})
  return { outcome: "timeout", status: lastStatus }
}
