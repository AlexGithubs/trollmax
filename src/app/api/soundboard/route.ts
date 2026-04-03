import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest } from "@/lib/manifests/types"
import {
  assertActivePresetProviderVoiceId,
  absoluteUrlForRefAudio,
  getVoicePresetById,
} from "@/lib/voice-presets/catalog"
import type { TtsTier } from "@/lib/manifests/types"
import {
  getUserEntitlements,
  canUsePresetForTier,
  canUseTtsTier,
} from "@/lib/billing/entitlements"
import { EXPANDED_MAX_PHRASE_CHARS, EXPANDED_MAX_PHRASES } from "@/lib/billing/config"
import { isAllowedUserUploadedAssetUrl } from "@/lib/security/user-media-url"
import { checkRateLimit } from "@/lib/rate-limit"

const CreateSchema = z
  .object({
    title: z.string().min(1).max(100),
    speakerLabel: z.string().min(1).max(80).optional(),
    voiceSampleUrl: z.string().url().optional(),
    voicePresetId: z.string().min(1).optional(),
    phrases: z.array(z.string()).min(1).max(EXPANDED_MAX_PHRASES),
    consentAcknowledged: z.literal(true),
    voiceRefText: z.string().max(1000).optional(),
    ttsTier: z.enum(["replicate", "elevenlabs"]).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPreset = Boolean(data.voicePresetId?.trim())
    const hasUpload = Boolean(data.voiceSampleUrl?.trim())
    if (hasPreset === hasUpload) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of voicePresetId or voiceSampleUrl",
        path: hasPreset && hasUpload ? ["voicePresetId"] : ["voiceSampleUrl"],
      })
    }
    if (hasUpload && !data.speakerLabel?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "speakerLabel is required when using voiceSampleUrl",
        path: ["speakerLabel"],
      })
    }
    for (let i = 0; i < data.phrases.length; i++) {
      const p = data.phrases[i]
      if (p && p.length > EXPANDED_MAX_PHRASE_CHARS) {
        ctx.addIssue({
          code: "custom",
          message: `Phrase ${i + 1} exceeds maximum length`,
          path: ["phrases", i],
        })
      }
    }
  })

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(user.id, "create")
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const ent = await getUserEntitlements(user.id)
  if (ent.soundboardCount >= ent.maxSoundboards) {
    return NextResponse.json(
      {
        error: `Soundboard limit reached (${ent.maxSoundboards}). Delete a board to create a new one.`,
        code: "SOUNDBOARD_LIMIT",
      },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const phrasesTrimmed = parsed.data.phrases.map((p) => p.trim()).filter((p) => p.length > 0)
  if (phrasesTrimmed.length === 0) {
    return NextResponse.json({ error: "Add at least one non-empty phrase." }, { status: 400 })
  }
  if (phrasesTrimmed.length > ent.maxPhrases) {
    return NextResponse.json(
      {
        error: `You can use up to ${ent.maxPhrases} phrase(s) per board.`,
        code: "PHRASE_LIMIT",
      },
      { status: 400 }
    )
  }
  for (let i = 0; i < phrasesTrimmed.length; i++) {
    if (phrasesTrimmed[i]!.length > ent.maxPhraseChars) {
      return NextResponse.json(
        {
          error: `Phrases may be up to ${ent.maxPhraseChars} characters.`,
          code: "PHRASE_LENGTH",
        },
        { status: 400 }
      )
    }
  }

  const { title, voiceRefText: bodyRefText } = parsed.data
  const origin = new URL(req.url).origin

  if (parsed.data.voiceSampleUrl?.trim()) {
    if (!isAllowedUserUploadedAssetUrl(parsed.data.voiceSampleUrl.trim(), origin)) {
      return NextResponse.json(
        {
          error: "Voice sample must be uploaded through TROLLMAX (or choose a preset).",
          code: "VOICE_SAMPLE_NOT_ALLOWED",
        },
        { status: 400 }
      )
    }
  }

  let voiceSampleUrl: string
  let voiceId: string
  let speakerLabel: string
  let resolvedRefText: string | undefined
  let voicePresetId: string | undefined
  let ttsTierResolved: TtsTier = "elevenlabs"

  if (parsed.data.voicePresetId) {
    const presetId = parsed.data.voicePresetId.trim()
    if (!canUsePresetForTier(presetId, false)) {
      return NextResponse.json(
        {
          error: "This preset is not available right now.",
          code: "PRESET_LOCKED",
        },
        { status: 403 }
      )
    }
    const preset = getVoicePresetById(presetId)
    if (!preset) {
      return NextResponse.json({ error: "Unknown voice preset" }, { status: 400 })
    }
    voiceSampleUrl = absoluteUrlForRefAudio(preset.refAudioUrl, origin)
    if (preset.status !== "active") {
      return NextResponse.json(
        { error: "This preset voice is coming soon. Choose an active preset." },
        { status: 400 }
      )
    }
    ttsTierResolved = parsed.data.ttsTier ?? "elevenlabs"
    if (!canUseTtsTier(ttsTierResolved, ent)) {
      return NextResponse.json(
        { error: "This TTS tier is not available." },
        { status: 403 }
      )
    }

    if (ttsTierResolved === "elevenlabs") {
      try {
        voiceId = assertActivePresetProviderVoiceId(preset)
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Preset voice unavailable" },
          { status: 500 }
        )
      }
    } else {
      voiceId = voiceSampleUrl
    }
    speakerLabel = preset.defaultSpeakerLabel
    resolvedRefText = preset.refText.trim() ? preset.refText : undefined
    voicePresetId = preset.id
  } else {
    ttsTierResolved = parsed.data.ttsTier ?? "elevenlabs"
    if (!canUseTtsTier(ttsTierResolved, ent)) {
      return NextResponse.json(
        { error: "This TTS tier is not available." },
        { status: 403 }
      )
    }
    voiceSampleUrl = parsed.data.voiceSampleUrl!
    voiceId = voiceSampleUrl
    speakerLabel = parsed.data.speakerLabel!.trim()
    resolvedRefText = bodyRefText?.trim() ? bodyRefText.trim() : undefined
  }

  const now = new Date().toISOString()
  const id = nanoid(10)

  const manifest: SoundboardManifest = {
    id,
    type: "soundboard",
    title,
    speakerLabel,
    voiceId,
    voiceSampleUrl,
    ttsTier: ttsTierResolved,
    ...(voicePresetId ? { voicePresetId } : {}),
    ...(resolvedRefText ? { voiceRefText: resolvedRefText } : {}),
    clips: [],
    phrases: phrasesTrimmed,
    isPublic: true,
    consentAcknowledged: true,
    ownerId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  const store = getManifestStore()
  await store.set(`soundboard:${id}`, JSON.stringify(manifest))
  await store.sadd(`user:${user.id}:soundboards`, id)

  return NextResponse.json(manifest, { status: 201 })
}
