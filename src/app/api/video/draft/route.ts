import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { getManifestStore } from "@/lib/storage"
import type { TtsTier, VideoManifest } from "@/lib/manifests/types"
import {
  assertActivePresetProviderVoiceId,
  absoluteUrlForRefAudio,
  getVoicePresetById,
} from "@/lib/voice-presets/catalog"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { MAX_VIDEO_SCRIPT_CHARS } from "@/lib/billing/video-generation-cost"
import { isAllowedUserUploadedAssetUrl } from "@/lib/security/user-media-url"
import { backgroundVideoIdForManifest } from "@/lib/video/backgrounds"
import { hasVideoDraftContent, videoDraftTitle } from "@/lib/video/video-draft"

const DraftUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  wizardStep: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  title: z.string().max(100).optional(),
  script: z.string().max(MAX_VIDEO_SCRIPT_CHARS).optional(),
  voiceKind: z.enum(["preset", "upload"]).optional(),
  selectedPresetId: z.string().nullable().optional(),
  voiceSampleUrl: z.string().optional(),
  voiceUploadRefText: z.string().max(1000).optional(),
  talkingMode: z.enum(["full", "half"]).optional(),
  headshotImageUrl: z.string().optional(),
  headshotName: z.string().max(120).optional(),
  headshotPresetId: z.string().nullable().optional(),
  backgroundVideoId: z.string().optional(),
  captionsEnabled: z.boolean().optional(),
  consentAcknowledged: z.boolean().optional(),
})

async function resolveVoiceFields(
  data: z.infer<typeof DraftUpsertSchema>,
  origin: string,
  existing?: VideoManifest
): Promise<{
  voiceId: string
  ttsTier: TtsTier
  voiceSampleUrl?: string
  voiceRefText?: string
  voicePresetId?: string
}> {
  const kind =
    data.voiceKind ??
    (existing?.voicePresetId
      ? "preset"
      : existing?.voiceId?.startsWith("http")
        ? "upload"
        : "preset")

  if (kind === "preset" && data.selectedPresetId?.trim()) {
    const preset = getVoicePresetById(data.selectedPresetId.trim())
    if (preset && preset.status === "active") {
      const voiceSampleUrl = absoluteUrlForRefAudio(preset.refAudioUrl, origin)
      try {
        const voiceId = assertActivePresetProviderVoiceId(preset)
        const rt = data.voiceUploadRefText?.trim() || preset.refText?.trim()
        return {
          voiceId,
          ttsTier: "elevenlabs",
          voiceSampleUrl,
          voiceRefText: rt ? rt : undefined,
          voicePresetId: preset.id,
        }
      } catch {
        // fall through to existing
      }
    }
  }

  if (kind === "upload" && data.voiceSampleUrl?.trim()) {
    const voiceId = data.voiceSampleUrl.trim()
    if (isAllowedUserUploadedAssetUrl(voiceId, origin)) {
      const rt = data.voiceUploadRefText?.trim()
      return {
        voiceId,
        ttsTier: "elevenlabs",
        voiceSampleUrl: voiceId,
        voiceRefText: rt ? rt : undefined,
      }
    }
  }

  return {
    voiceId: existing?.voiceId ?? "",
    ttsTier: existing?.ttsTier ?? "elevenlabs",
    voiceSampleUrl: existing?.voiceSampleUrl,
    voiceRefText: existing?.voiceRefText,
    voicePresetId: existing?.voicePresetId,
  }
}

export async function PUT(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = DraftUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  if (!hasVideoDraftContent(parsed.data)) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 })
  }

  const origin = new URL(req.url).origin
  const store = getManifestStore()
  const now = new Date().toISOString()
  const talkingMode = parsed.data.talkingMode ?? "full"
  const backgroundVideoId = parsed.data.backgroundVideoId ?? "minecraft"
  const headshotImageUrl = parsed.data.headshotImageUrl?.trim() ?? ""

  if (headshotImageUrl && !isAllowedUserUploadedAssetUrl(headshotImageUrl, origin)) {
    return NextResponse.json(
      { error: "Headshot must be uploaded through TROLLMAX." },
      { status: 400 }
    )
  }

  let existing: VideoManifest | undefined
  if (parsed.data.id) {
    const raw = await store.get(`video:${parsed.data.id}`)
    if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 })
    existing = JSON.parse(raw) as VideoManifest
    if (existing.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Only draft videos can be updated." }, { status: 409 })
    }
  } else {
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
  }

  const voice = await resolveVoiceFields(parsed.data, origin, existing)

  const id = existing?.id ?? nanoid(10)
  const manifest: VideoManifest = {
    id,
    type: "video",
    title: videoDraftTitle(parsed.data),
    script: parsed.data.script?.trim() ?? existing?.script ?? "",
    voiceId: voice.voiceId,
    ttsTier: voice.ttsTier,
    ...(voice.voiceSampleUrl ? { voiceSampleUrl: voice.voiceSampleUrl } : {}),
    ...(voice.voiceRefText ? { voiceRefText: voice.voiceRefText } : {}),
    ...(voice.voicePresetId ? { voicePresetId: voice.voicePresetId } : {}),
    audioUrl: "",
    backgroundVideoId: backgroundVideoIdForManifest(
      talkingMode,
      backgroundVideoId
    ),
    headshotImageUrl: headshotImageUrl || existing?.headshotImageUrl || "",
    headshotPresetId:
      parsed.data.headshotPresetId !== undefined
        ? parsed.data.headshotPresetId ?? undefined
        : existing?.headshotPresetId,
    talkingMode,
    captionsEnabled: parsed.data.captionsEnabled ?? existing?.captionsEnabled ?? false,
    captions: [],
    status: "draft",
    isPublic: true,
    consentAcknowledged:
      parsed.data.consentAcknowledged ?? existing?.consentAcknowledged ?? false,
    ownerId: user.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(parsed.data.wizardStep ? { wizardStep: parsed.data.wizardStep } : {}),
  }

  await store.set(`video:${id}`, JSON.stringify(manifest))
  if (!existing) {
    await store.sadd(`user:${user.id}:videos`, id)
  }

  return NextResponse.json({ id, manifest })
}
