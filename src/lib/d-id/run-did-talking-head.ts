import { buildDidAuthHeader } from "@/lib/d-id/auth-header"
import { buildDidTalkCreateBody } from "@/lib/d-id/build-talk-create-body"
import { DidCelebrityBlockedError } from "@/lib/d-id/did-celebrity-error"
import {
  DID_IN_PROGRESS_STATUSES,
  DID_POLL_INTERVAL_MS,
  didTalkMaxWaitMs,
  isDidSuccessStatus,
  isDidTerminalFailureStatus,
} from "@/lib/d-id/poll-config"
import {
  isDidCelebrityDetectedBody,
  userMessageFromDidErrorBody,
} from "@/lib/d-id/user-message-from-did-error"
import { didAudioUrlFromBlobUrl } from "@/lib/d-id/upload-audio-for-talk"
import { didSourceUrlFromHeadshotBuffer } from "@/lib/d-id/upload-headshot-for-talk"
import { GenerationUserInputError } from "@/lib/generation/errors"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type DidPollProgress = {
  attempt: number
  status: string
  elapsedSec: number
}

/**
 * If a talk job stays in "created" for this long without moving to "started",
 * it is considered truly stalled and will be cancelled so a retry can be attempted.
 *
 * D-ID's Lite plan can take up to ~60s to transition from "created" to "started"
 * under normal load. 90s gives ample room for slow queue conditions while still
 * catching genuine permanent stalls (e.g. from unsupported API params).
 */
const CREATED_STALL_MS = 90_000
const MAX_RETRIES = 1

/** Cancel a D-ID talk job (best-effort — ignore failures). */
async function cancelDidTalk(talkId: string, authHeader: string): Promise<void> {
  await fetch(`https://api.d-id.com/talks/${talkId}`, {
    method: "DELETE",
    headers: { Authorization: authHeader },
  }).catch(() => {})
}

type OnceResult =
  | { kind: "done"; url: string }
  | { kind: "stalled"; talkId: string }
  | { kind: "error"; error: unknown }

/**
 * Submit one D-ID talk and poll until done, stalled, or terminal failure.
 * Returns a typed discriminated union so the caller can decide whether to retry.
 */
async function runOnce(input: {
  sourceUrl: string
  audioUrlForDid: string
  title: string
  logRef: string
  authHeader: string
  onPoll?: (progress: DidPollProgress) => Promise<void>
}): Promise<OnceResult> {
  const { sourceUrl, audioUrlForDid, title, logRef, authHeader, onPoll } = input
  const maxWaitMs = didTalkMaxWaitMs()

  const createBody = buildDidTalkCreateBody({ sourceUrl, audioUrl: audioUrlForDid, title })

  const createStarted = Date.now()
  const createRes = await fetch("https://api.d-id.com/talks", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(createBody),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "")
    if (isDidCelebrityDetectedBody(text)) return { kind: "error", error: new DidCelebrityBlockedError() }
    const friendly = userMessageFromDidErrorBody(createRes.status, text)
    if (friendly) return { kind: "error", error: new GenerationUserInputError(friendly) }
    return {
      kind: "error",
      error: new Error(
        `D-ID create talk failed: ${createRes.status} ${createRes.statusText}${text ? ` — ${text}` : ""}`
      ),
    }
  }

  const createJson = (await createRes.json()) as { id?: string; status?: string }
  const talkId = createJson.id
  if (!talkId) return { kind: "error", error: new Error("D-ID create talk failed: missing id") }

  console.log(
    `[video/generate] D-ID ${logRef} create ${talkId}: ${Date.now() - createStarted}ms (status=${createJson.status ?? "created"})`
  )

  let didStatus = createJson.status ?? "created"
  let resultUrl: string | undefined
  const pollStartedAt = Date.now()
  let lastLoggedStatus = didStatus
  let pollAttempt = 0
  let firstMovedFromCreated = false

  while (Date.now() - pollStartedAt <= maxWaitMs) {
    if (pollAttempt > 0) await sleep(DID_POLL_INTERVAL_MS)
    pollAttempt++

    if (onPoll) {
      await onPoll({
        attempt: pollAttempt,
        status: didStatus,
        elapsedSec: Math.round((Date.now() - pollStartedAt) / 1000),
      })
    }

    // Stall detection: if status has never left "created" after CREATED_STALL_MS,
    // cancel this job and signal the caller to retry.
    if (
      !firstMovedFromCreated &&
      didStatus === "created" &&
      Date.now() - pollStartedAt > CREATED_STALL_MS
    ) {
      console.warn(
        `[video/generate] D-ID ${logRef} ${talkId}: stalled in "created" after ${CREATED_STALL_MS / 1000}s — cancelling for retry`
      )
      await cancelDidTalk(talkId, authHeader)
      return { kind: "stalled", talkId }
    }

    const statusRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    })

    if (!statusRes.ok) {
      const text = await statusRes.text().catch(() => "")
      return {
        kind: "error",
        error: new Error(
          `D-ID status check failed: ${statusRes.status} ${statusRes.statusText}${text ? ` — ${text}` : ""}`
        ),
      }
    }

    const statusJson = (await statusRes.json()) as {
      status?: string
      result_url?: string
      error_message?: string
      message?: string
    }

    didStatus = statusJson.status ?? didStatus
    if (didStatus !== "created") firstMovedFromCreated = true

    if (didStatus !== lastLoggedStatus) {
      const dwellSec = Math.round((Date.now() - pollStartedAt) / 1000)
      console.log(
        `[video/generate] D-ID ${logRef} ${talkId}: ${lastLoggedStatus} → ${didStatus} (${dwellSec}s)`
      )
      lastLoggedStatus = didStatus
    }

    if (isDidSuccessStatus(didStatus)) {
      resultUrl = statusJson.result_url
      break
    }

    if (isDidTerminalFailureStatus(didStatus)) {
      const blob = JSON.stringify(statusJson)
      if (isDidCelebrityDetectedBody(blob)) return { kind: "error", error: new DidCelebrityBlockedError() }
      const em = String(statusJson.error_message ?? statusJson.message ?? "")
      if (isDidCelebrityDetectedBody(em)) return { kind: "error", error: new DidCelebrityBlockedError() }
      return {
        kind: "error",
        error: new Error(statusJson.error_message ?? statusJson.message ?? `D-ID failed: ${didStatus}`),
      }
    }

    if (!DID_IN_PROGRESS_STATUSES.has(didStatus)) {
      console.warn(`[video/generate] D-ID ${logRef} ${talkId}: unknown status "${didStatus}", continuing poll`)
    }

  }

  if (!resultUrl) {
    return {
      kind: "error",
      error: new Error(
        `D-ID talking-head generation timed out after ${Math.round(maxWaitMs / 1000)}s (last status: ${didStatus}, talk id: ${talkId})`
      ),
    }
  }

  console.log(
    `[video/generate] D-ID ${logRef} ${talkId}: done in ${Math.round((Date.now() - pollStartedAt) / 1000)}s poll`
  )
  return { kind: "done", url: resultUrl }
}

export async function runDidTalkingHead(input: {
  headshotImageUrl: string
  audioUrl: string
  title: string
  logRef: string
  onPoll?: (progress: DidPollProgress) => Promise<void>
}): Promise<string> {
  const authHeader = buildDidAuthHeader()

  // Upload assets once — the same URLs are reused across retries.
  const uploadStarted = Date.now()
  const [sourceUrl, audioUrlForDid] = await Promise.all([
    didSourceUrlFromHeadshotBuffer(input.headshotImageUrl, authHeader),
    didAudioUrlFromBlobUrl(input.audioUrl, authHeader),
  ])
  console.log(`[video/generate] D-ID ${input.logRef} uploads: ${Date.now() - uploadStarted}ms`)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[video/generate] D-ID ${input.logRef}: retry attempt ${attempt}`)
    }

    const result = await runOnce({
      sourceUrl,
      audioUrlForDid,
      title: input.title,
      logRef: input.logRef,
      authHeader,
      onPoll: input.onPoll,
    })

    if (result.kind === "done") return result.url
    if (result.kind === "stalled") continue // retry
    // Terminal error — rethrow immediately, no retry
    throw result.error
  }

  throw new Error(`D-ID talking-head generation failed after ${MAX_RETRIES} retries`)
}
