/** Wall-clock max wait for D-ID POST /talks to reach `done` (seconds). */
export const DEFAULT_DID_TALK_MAX_WAIT_SEC = 120

/** Poll interval while waiting on D-ID (ms). */
export const DID_POLL_INTERVAL_MS = 2_000

export function didTalkMaxWaitMs(): number {
  const raw = process.env.DID_TALK_MAX_WAIT_SEC?.trim()
  if (!raw) return DEFAULT_DID_TALK_MAX_WAIT_SEC * 1000
  const sec = Number(raw)
  if (!Number.isFinite(sec) || sec < 30) return DEFAULT_DID_TALK_MAX_WAIT_SEC * 1000
  return Math.min(sec, 180) * 1000
}

/** D-ID statuses that mean the job is still in progress (not an error). */
export const DID_IN_PROGRESS_STATUSES = new Set([
  "created",
  "started",
  "processing",
  "pending",
])

export function isDidTerminalFailureStatus(status: string): boolean {
  return status === "error" || status === "rejected"
}

export function isDidSuccessStatus(status: string): boolean {
  return status === "done"
}
