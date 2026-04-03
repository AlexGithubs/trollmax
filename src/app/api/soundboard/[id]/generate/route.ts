export const maxDuration = 300

import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { getManifestStore } from "@/lib/storage"
import { resolveSoundboardVoiceForGenerate } from "@/lib/tts/resolve-voice-for-generate"
import type { TTSProvider } from "@/lib/providers/types"
import { checkRateLimit } from "@/lib/rate-limit"
import { normalizeTextForTTS } from "@/lib/text/tts-normalize"
import type { SoundboardManifest, SoundClip } from "@/lib/manifests/types"
import { getUserEntitlements, canUsePresetForTier } from "@/lib/billing/entitlements"
import { BASE_MAX_PHRASE_CHARS, BASE_MAX_PHRASES } from "@/lib/billing/config"
import {
  BANANA_CREDIT_COSTS,
  canAffordBananaCredits,
  getBananaCreditsBalance,
  tryDebitBananaCredits,
  creditBananaCredits,
} from "@/lib/billing/banana-credits"
import { jsonGenerationErrorResponse } from "@/lib/security/generation-error"
import {
  getProductionDependencyIssues,
  shouldEnforceProductionDeps,
} from "@/lib/runtime/check-production-deps"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const logCtx = (soundboardId: string) => ({ soundboardId })

/** Logs to Vercel Function / server logs (filter by `[soundboard/generate]`). */
function genLog(soundboardId: string, step: string, detail?: Record<string, unknown>) {
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[soundboard/generate] soundboardId=${soundboardId} step=${step}`, detail)
  } else {
    console.log(`[soundboard/generate] soundboardId=${soundboardId} step=${step}`)
  }
}

function voiceIdForLog(v: string): { kind: "url" | "id"; preview: string } {
  const t = v.trim()
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      return { kind: "url", preview: `${u.hostname}${u.pathname.slice(0, 40)}…` }
    } catch {
      return { kind: "url", preview: t.slice(0, 60) + (t.length > 60 ? "…" : "") }
    }
  }
  return { kind: "id", preview: t.length > 64 ? `${t.slice(0, 64)}…` : t }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "generate")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const { id } = await params
  const store = getManifestStore()

  if (shouldEnforceProductionDeps()) {
    const deps = getProductionDependencyIssues()
    if (!deps.ok) {
      return NextResponse.json(
        {
          error: "Server storage is not configured for generation. Open /api/health for details.",
          code: "SERVER_MISCONFIGURED",
          issues: deps.issues,
        },
        { status: 503 }
      )
    }
  }

  const raw = await store.get(`soundboard:${id}`)
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const lockKey = `generate_lock:soundboard:${id}`
  let lockHeld = false
  let creditsDebited = 0

  try {
    let manifest: SoundboardManifest
    try {
      manifest = JSON.parse(raw) as SoundboardManifest
    } catch (err) {
      return jsonGenerationErrorResponse("soundboard/generate:parse", err, 500, logCtx(id))
    }

    if (manifest.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const lockAcquired = typeof store.setNX === "function" ? await store.setNX(lockKey, 360) : true
    if (!lockAcquired) {
      if (manifest.status === "processing") return NextResponse.json(manifest)
      return NextResponse.json({ error: "Generation already in progress. Please wait." }, { status: 409 })
    }
    lockHeld = true

    // Idempotency — duplicate POSTs while a run is in flight should not start a second job.
    if (manifest.status === "processing") {
      return NextResponse.json(manifest)
    }

  const ent = await getUserEntitlements(user.id)
  if (manifest.voicePresetId && !canUsePresetForTier(manifest.voicePresetId, false)) {
    return NextResponse.json(
      {
        error: "This board uses a preset that is not available right now.",
        code: "PRESET_LOCKED",
      },
      { status: 403 }
    )
  }
  if (manifest.phrases.length > ent.maxPhrases) {
    return NextResponse.json(
      { error: `You can use up to ${ent.maxPhrases} phrases per board.` },
      { status: 400 }
    )
  }
  for (const phrase of manifest.phrases) {
    if (phrase.length > ent.maxPhraseChars) {
      return NextResponse.json(
        {
          error: `Phrases may be up to ${ent.maxPhraseChars} characters.`,
          code: "PHRASE_LENGTH",
        },
        { status: 400 }
      )
    }
  }

  const requiresExpansion =
    manifest.phrases.length > BASE_MAX_PHRASES ||
    manifest.phrases.some((phrase) => phrase.length > BASE_MAX_PHRASE_CHARS)
  const generationCost =
    BANANA_CREDIT_COSTS.soundboardGenerate +
    (requiresExpansion ? BANANA_CREDIT_COSTS.soundboardExpansion : 0)

  genLog(id, "run_start", {
    ttsTier: manifest.ttsTier ?? "(legacy infer)",
    voicePresetId: manifest.voicePresetId ?? null,
    phraseCount: manifest.phrases.length,
    generationCost,
    requiresExpansion,
  })

  const canAfford = await canAffordBananaCredits(user.id, generationCost)
  if (!canAfford) {
    const balance = await getBananaCreditsBalance(user.id)
    return NextResponse.json(
      {
        error: "Insufficient banana credits.",
        code: "INSUFFICIENT_BANANA_CREDITS",
        required: generationCost,
        balance,
      },
      { status: 402 }
    )
  }

  const updateProgress = async (patch: Partial<SoundboardManifest>) => {
    const raw2 = await store.get(`soundboard:${id}`)
    if (!raw2) return
    const cur = JSON.parse(raw2) as SoundboardManifest
    await store.set(
      `soundboard:${id}`,
      JSON.stringify({ ...cur, ...patch, updatedAt: new Date().toISOString() })
    )
  }

  const manifestSnapshot = { ...manifest }

  await updateProgress({
    status: "processing",
    progressStep: "Starting…",
    progressPct: 0,
    progressDetail: undefined,
    lastError: undefined,
  })

  const debit = await tryDebitBananaCredits(user.id, generationCost)
  if (!debit.ok) {
    await store.set(
      `soundboard:${id}`,
      JSON.stringify({ ...manifestSnapshot, updatedAt: new Date().toISOString() })
    )
    return NextResponse.json(
      {
        error: "Insufficient banana credits.",
        code: "INSUFFICIENT_BANANA_CREDITS",
        required: generationCost,
        balance: debit.balance,
      },
      { status: 402 }
    )
  }
  creditsDebited = generationCost
  const balanceAfterDebit = debit.balance
  genLog(id, "credits_debited", { generationCost, balanceAfterDebit })
  genLog(id, "before_preparing_voice_update")

  let voiceId: string
  let refTextForSynth: string | undefined
  let provider: TTSProvider

  try {
    await updateProgress({ progressStep: "Preparing voice…", progressPct: 5 })
    genLog(id, "after_preparing_voice_update")
    genLog(id, "voice_prep_begin")
    const persist = async (next: SoundboardManifest) => {
      await store.set(`soundboard:${id}`, JSON.stringify(next))
    }
    const ctx = await resolveSoundboardVoiceForGenerate(manifest, persist)
    provider = ctx.provider
    voiceId = ctx.voiceId
    refTextForSynth = ctx.refText
    genLog(id, "voice_prep_ok", {
      provider: provider.constructor?.name ?? "TTSProvider",
      voiceId: voiceIdForLog(voiceId),
      hasRefText: Boolean(refTextForSynth?.trim()),
    })
  } catch (err) {
    console.error(
      `[soundboard/generate] soundboardId=${id} step=voice_prep_failed`,
      err instanceof Error ? err.message : err,
      err instanceof Error ? err.stack : ""
    )
    await creditBananaCredits(user.id, generationCost).catch((refundErr) => {
      console.error("[soundboard/generate] credit refund failed (voice):", refundErr)
    })
    await updateProgress({
      status: "failed",
      progressStep: "Failed",
      progressPct: 100,
      lastError: err instanceof Error ? err.message : String(err),
    })
    return jsonGenerationErrorResponse("soundboard/generate:voice", err, 500, logCtx(id))
  }

  async function synthesizeWithRetry(
    phraseForSpeech: string,
    retries = 4
  ): Promise<{ audioUrl: string; durationSeconds: number }> {
    try {
      return await provider.synthesize({
        voiceId,
        text: phraseForSpeech,
        language: "en",
        ...(refTextForSynth ? { refText: refTextForSynth } : {}),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes("429") || msg.toLowerCase().includes("throttled")
      const m = msg.match(/"retry_after"\s*:\s*(\d+)/)
      const waitMs = m ? (parseInt(m[1]) + 2) * 1000 : 15000
      if (is429 && retries > 0) {
        console.log(`[generate] 429 — waiting ${waitMs}ms, ${retries - 1} retries left`)
        await sleep(waitMs)
        return synthesizeWithRetry(phraseForSpeech, retries - 1)
      }
      throw err
    }
  }

  const now = new Date().toISOString()
  let clips: SoundClip[]

  try {
    clips = []
    const total = manifest.phrases.length
    const concurrency = Math.max(1, Math.min(3, total))
    genLog(id, "clips_begin", { total, concurrency })
    let completed = 0

    // Preserve original order in output.
    const results: Array<
      | { ok: true; idx: number; phrase: string; audioUrl: string; durationSeconds: number }
      | { ok: false; idx: number; phrase: string; error: unknown }
    > = []

    let nextIdx = 0
    const inFlight = new Set<Promise<void>>()

    const launch = (idx: number) => {
      const phrase = manifest.phrases[idx]!
      const phraseForSpeech = normalizeTextForTTS(phrase)

      const p = (async () => {
        console.log(`[generate] Synthesizing "${phrase}" => "${phraseForSpeech}"`)
        await updateProgress({
          progressStep: "Synthesizing clips…",
          progressPct: 10 + Math.round((completed / Math.max(1, total)) * 80),
          progressDetail: `Starting clip ${idx + 1} of ${total}`,
        })
        try {
          const { audioUrl, durationSeconds } = await synthesizeWithRetry(phraseForSpeech)
          results.push({ ok: true, idx, phrase, audioUrl, durationSeconds })
        } catch (error) {
          console.error(
            `[soundboard/generate] soundboardId=${id} step=clip_synth_failed clip=${idx + 1}/${total}`,
            error instanceof Error ? error.message : error,
            error instanceof Error ? error.stack : ""
          )
          results.push({ ok: false, idx, phrase, error })
        } finally {
          completed++
          await updateProgress({
            progressStep: "Synthesizing clips…",
            progressPct: 10 + Math.round((completed / Math.max(1, total)) * 80),
            progressDetail: `Completed ${completed} of ${total}`,
          })
        }
      })().finally(() => {
        inFlight.delete(p)
      })

      inFlight.add(p)
    }

    while (nextIdx < total && inFlight.size < concurrency) {
      launch(nextIdx++)
    }

    while (inFlight.size > 0) {
      await Promise.race(inFlight)
      while (nextIdx < total && inFlight.size < concurrency) {
        launch(nextIdx++)
      }
    }

    const failed = results.find((r) => !r.ok) as
      | { ok: false; idx: number; phrase: string; error: unknown }
      | undefined
    if (failed) {
      throw failed.error instanceof Error
        ? failed.error
        : new Error(`Synthesis failed for phrase ${failed.idx + 1}`)
    }

    const okResults = results
      .filter((r): r is { ok: true; idx: number; phrase: string; audioUrl: string; durationSeconds: number } => r.ok)
      .sort((a, b) => a.idx - b.idx)

    for (const r of okResults) {
      const clipId = nanoid(8)
      clips.push({
        id: clipId,
        label: r.phrase,
        text: r.phrase,
        audioUrl: `/api/soundboard/${id}/clips/${clipId}`,
        sourceUrl: r.audioUrl,
        durationSeconds: r.durationSeconds,
        createdAt: now,
      })
    }
  } catch (err) {
    console.error(
      `[soundboard/generate] soundboardId=${id} step=clips_failed`,
      err instanceof Error ? err.message : err,
      err instanceof Error ? err.stack : ""
    )
    await creditBananaCredits(user.id, generationCost).catch((refundErr) => {
      console.error("[soundboard/generate] credit refund failed (clips):", refundErr)
    })
    await updateProgress({
      status: "failed",
      progressStep: "Failed",
      progressPct: 100,
      lastError: err instanceof Error ? err.message : String(err),
    })
    return jsonGenerationErrorResponse("soundboard/generate:clips", err, 500, logCtx(id))
  }

  const rawLatest = await store.get(`soundboard:${id}`)
  let latestBase: SoundboardManifest = manifest
  if (rawLatest) {
    try {
      latestBase = JSON.parse(rawLatest) as SoundboardManifest
    } catch {
      /* keep manifest; avoid post-success throw → outer catch → wrongful refund */
    }
  }

  const updated: SoundboardManifest = {
    ...latestBase,
    voiceId,
    clips,
    status: "complete",
    progressStep: "Complete",
    progressPct: 100,
    progressDetail: undefined,
    lastError: undefined,
    updatedAt: now,
  }
  await store.set(`soundboard:${id}`, JSON.stringify(updated))
  genLog(id, "complete", { clipCount: clips.length })
  return NextResponse.json({
    ...updated,
    bananaCreditsCharged: generationCost,
    bananaCreditsBalance: balanceAfterDebit,
  })
  } catch (unexpected) {
    console.error(
      `[soundboard/generate] soundboardId=${id} step=unexpected_failure`,
      unexpected instanceof Error ? unexpected.message : unexpected,
      unexpected instanceof Error ? unexpected.stack : ""
    )
    if (creditsDebited > 0) {
      await creditBananaCredits(user.id, creditsDebited).catch((refundErr) => {
        console.error("[soundboard/generate] credit refund failed (unexpected):", refundErr)
      })
    }
    const curRaw = await store.get(`soundboard:${id}`)
    if (curRaw) {
      try {
        const cur = JSON.parse(curRaw) as SoundboardManifest
        if (cur.ownerId === user.id) {
          await store.set(
            `soundboard:${id}`,
            JSON.stringify({
              ...cur,
              status: "failed",
              progressStep: "Failed",
              progressPct: 100,
              lastError:
                unexpected instanceof Error ? unexpected.message : String(unexpected),
              updatedAt: new Date().toISOString(),
            })
          )
        }
      } catch {
        /* ignore corrupt KV during error handling */
      }
    }
    return jsonGenerationErrorResponse(
      "soundboard/generate:unexpected",
      unexpected,
      500,
      logCtx(id)
    )
  } finally {
    if (lockHeld) await store.del(lockKey).catch(() => {})
  }
}
