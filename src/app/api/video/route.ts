import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest, TtsTier, VideoManifest } from "@/lib/manifests/types"
import {
  assertActivePresetProviderVoiceId,
  absoluteUrlForRefAudio,
  getVoicePresetById,
} from "@/lib/voice-presets/catalog"
import { canUseTtsTier, getUserEntitlements } from "@/lib/billing/entitlements"
import { isAllowedUserUploadedAssetUrl } from "@/lib/security/user-media-url"
import { checkRateLimit } from "@/lib/rate-limit"
const TtsTierSchema = z.enum(["replicate", "elevenlabs"])

const CreateSchema = z
  .object({
    /** Display name (dashboard, share page). If omitted or empty, falls back to script prefix (legacy). */
    title: z.string().max(100).optional(),
    script: z.string().min(1).max(2000),
    backgroundVideoId: z.string().min(1),
    headshotImageUrl: z.string().url(),
    talkingMode: z.enum(["full", "half"]),
    captionsEnabled: z.boolean().optional(),
    consentAcknowledged: z.literal(true),
    voiceId: z.string().min(1).optional(),
    voicePresetId: z.string().min(1).optional(),
    soundboardId: z.string().min(1).optional(),
    voiceRefText: z.string().max(1000).optional(),
    ttsTier: TtsTierSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasPreset = Boolean(data.voicePresetId?.trim())
    const hasVoice = Boolean(data.voiceId?.trim())
    const hasBoard = Boolean(data.soundboardId?.trim())
    const n = [hasPreset, hasVoice, hasBoard].filter(Boolean).length
    if (n !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of voicePresetId, voiceId, or soundboardId",
        path: ["voiceId"],
      })
    }
  })

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "create")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const ent = await getUserEntitlements(user.id)
  if (ent.videoCount >= ent.maxVideos) {
    return NextResponse.json(
      {
        error: `Video limit reached (${ent.maxVideos}). Delete a video to create a new one.`,
        code: "VIDEO_LIMIT",
      },
      { status: 403 }
    )
  }
  const { script, backgroundVideoId, headshotImageUrl, talkingMode } = parsed.data
  const titleInput = parsed.data.title?.trim() ?? ""
  const fallbackFromScript = script.trim().slice(0, 60) || "Untitled video"
  const title = (titleInput.length > 0 ? titleInput : fallbackFromScript).slice(0, 100)
  const captionsEnabled = parsed.data.captionsEnabled ?? true
  const origin = new URL(req.url).origin

  if (!isAllowedUserUploadedAssetUrl(headshotImageUrl, origin)) {
    return NextResponse.json(
      { error: "Headshot must be uploaded through TROLLMAX." },
      { status: 400 }
    )
  }

  let voiceId: string
  let voiceRefText: string | undefined
  let voicePresetId: string | undefined
  let soundboardId: string | undefined
  let voiceSampleUrl: string | undefined
  let ttsTier: TtsTier = (parsed.data.ttsTier as TtsTier | undefined) ?? "elevenlabs"

  if (parsed.data.soundboardId) {
    soundboardId = parsed.data.soundboardId.trim()
    const store = getManifestStore()
    const raw = await store.get(`soundboard:${soundboardId}`)
    if (!raw) {
      return NextResponse.json({ error: "Soundboard not found" }, { status: 404 })
    }
    const board = JSON.parse(raw) as SoundboardManifest
    if (board.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    ttsTier = board.ttsTier ?? (board.voiceId?.startsWith("http") ? "replicate" : "elevenlabs")
    if (!canUseTtsTier(ttsTier, ent)) {
      return NextResponse.json({ error: "This TTS tier is not available." }, { status: 403 })
    }
    voiceId = board.voiceId
    voiceSampleUrl = board.voiceSampleUrl
    voiceRefText = board.voiceRefText?.trim() || undefined
    voicePresetId = board.voicePresetId
  } else if (parsed.data.voicePresetId) {
    const preset = getVoicePresetById(parsed.data.voicePresetId.trim())
    if (!preset) {
      return NextResponse.json({ error: "Unknown voice preset" }, { status: 400 })
    }
    if (preset.status !== "active") {
      return NextResponse.json(
        { error: "This preset voice is coming soon. Choose an active preset." },
        { status: 400 }
      )
    }
    // Video generation with catalog presets always uses ElevenLabs (not Replicate F5).
    ttsTier = "elevenlabs"
    if (!canUseTtsTier(ttsTier, ent)) {
      return NextResponse.json({ error: "This TTS tier is not available." }, { status: 403 })
    }

    voiceSampleUrl = absoluteUrlForRefAudio(preset.refAudioUrl, origin)

    try {
      voiceId = assertActivePresetProviderVoiceId(preset)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Preset voice unavailable" },
        { status: 500 }
      )
    }

    const rt = parsed.data.voiceRefText?.trim() || preset.refText?.trim()
    voiceRefText = rt ? rt : undefined
    voicePresetId = preset.id
  } else {
    voiceId = parsed.data.voiceId!.trim()
    const rt = parsed.data.voiceRefText?.trim()
    voiceRefText = rt ? rt : undefined
    ttsTier = parsed.data.ttsTier ?? "elevenlabs"
    if (!canUseTtsTier(ttsTier, ent)) {
      return NextResponse.json({ error: "This TTS tier is not available." }, { status: 403 })
    }
    voiceSampleUrl = voiceId.startsWith("http") ? voiceId : undefined
    if (voiceSampleUrl && !isAllowedUserUploadedAssetUrl(voiceSampleUrl, origin)) {
      return NextResponse.json(
        { error: "Voice sample must be uploaded through TROLLMAX." },
        { status: 400 }
      )
    }
  }

  const now = new Date().toISOString()
  const id = nanoid(10)

  const manifest: VideoManifest = {
    id,
    type: "video",
    title,
    script,
    voiceId,
    ttsTier,
    ...(voiceSampleUrl ? { voiceSampleUrl } : {}),
    ...(voiceRefText ? { voiceRefText } : {}),
    ...(voicePresetId ? { voicePresetId } : {}),
    ...(soundboardId ? { soundboardId } : {}),
    audioUrl: "",
    backgroundVideoId,
    headshotImageUrl,
    talkingMode,
    captionsEnabled,
    captions: [],
    status: "draft",
    isPublic: true,
    consentAcknowledged: true,
    ownerId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  const store = getManifestStore()
  await store.set(`video:${id}`, JSON.stringify(manifest))
  await store.sadd(`user:${user.id}:videos`, id)

  return NextResponse.json(manifest, { status: 201 })
}
