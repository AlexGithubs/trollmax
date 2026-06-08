"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser, useClerk } from "@clerk/nextjs"
import Link from "next/link"
import { emitBananaCreditsUpdated } from "@/lib/client/banana-credits-bridge"
import NextImage from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VideoGeneratingCard, type VideoGenerationErrorKind } from "@/components/video/VideoGeneratingCard"
import {
  Mic2,
  ArrowRight,
  Sparkles,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { trimAndEncodeAudio } from "@/lib/audio/trim-and-encode"
import type { SoundboardManifest } from "@/lib/manifests/types"
import type {
  VoicePresetPublic,
  VoicePresetCategory,
} from "@/lib/voice-presets/catalog"
import { toggleOrPlayPresetPreview } from "@/lib/voice-presets/preset-preview-client"
import { validateHeadshotFace } from "@/lib/headshot/validate-headshot-face"
import {
  currencyIconAlt,
  currencyIconSrc,
  formatCurrencyCost,
} from "@/lib/billing/currency-display"
import { videoGenerationCostBananaCredits } from "@/lib/billing/video-generation-cost"
import { CreditGateScreen } from "@/components/billing/CreditGateScreen"
import { clearPendingGeneration } from "@/lib/client/pending-generation"
import {
  PENDING_GENERATION_RESUME_EVENT,
  type PendingGenerationResumeDetail,
} from "@/lib/client/resume-generation"
import {
  HEADSHOT_PRESETS,
  headshotPresetImageSrc,
  type HeadshotPreset,
} from "@/lib/headshot-presets/catalog"
import { cn } from "@/lib/utils"
import { MoreOptions } from "@/components/video/MoreOptions"
import { SCRIPT_TEMPLATES } from "@/lib/video/script-templates"
import { VideoWizardStepper, type WizardStep } from "./VideoWizardStepper"
import { VideoWizardFooter } from "./VideoWizardFooter"
import { LayoutOptionPicker } from "./LayoutOptionPicker"
import {
  TOUR_STEP_CHANGED_EVENT,
  TOUR_VIDEO_WIZARD_STEP,
  WIZARD_STEP_READY_EVENT,
  type TourStepChangedDetail,
} from "@/lib/client/video-form-draft"
import {
  loadVideoDraftManifest,
  upsertVideoDraft,
  videoEditHref,
} from "@/lib/client/video-draft"
import { hasVideoDraftContent, type VideoDraftUpsertBody } from "@/lib/video/video-draft"
import type { VideoManifest } from "@/lib/manifests/types"

// D-ID is strict about image size; we target a safer ceiling before upload.
const DID_HEADSHOT_TARGET_BYTES = 9_000_000

/** Same rule as server `isPrivateVercelBlobUrl` — private blob URLs are not usable as `<img src>`. */
function isPrivateVercelBlobUrlClient(url: string): boolean {
  return (
    url.includes("blob.vercel-storage.com") &&
    !url.includes(".public.blob.vercel-storage.com")
  )
}

/** Resolve a URL safe for `<img src>` from stored headshot state. */
function resolveHeadshotDisplayUrl(
  previewUrl: string,
  imageUrl: string,
  presetId: string | null
): string {
  if (presetId && imageUrl) {
    const preset = HEADSHOT_PRESETS.find((p) => p.id === presetId)
    if (preset) return headshotPresetImageSrc(preset)
  }
  if (previewUrl.startsWith("blob:")) return previewUrl
  if (previewUrl && !isPrivateVercelBlobUrlClient(previewUrl)) return previewUrl
  if (imageUrl && !isPrivateVercelBlobUrlClient(imageUrl)) return imageUrl
  return ""
}

type VoiceKind = "preset" | "board" | "upload"

type FormDraftSnapshot = {
  wizardStep: WizardStep
  videoTitle: string
  script: string
  voiceKind: VoiceKind
  selectedPresetId: string | null
  selectedBoardId: string
  voiceSampleUrl: string
  voiceUploadRefText: string
  talkingMode: "full" | "half"
  headshotImageUrl: string
  headshotName: string
  selectedHeadshotPresetId: string | null
  backgroundVideoId: string
  captionsEnabled: boolean
  consent: boolean
}

function buildServerDraftPayload(
  snapshot: FormDraftSnapshot,
  draftManifestId: string | null
): VideoDraftUpsertBody {
  return {
    ...(draftManifestId ? { id: draftManifestId } : {}),
    wizardStep: snapshot.wizardStep,
    title: snapshot.videoTitle,
    script: snapshot.script,
    voiceKind: snapshot.voiceKind,
    selectedPresetId: snapshot.selectedPresetId,
    selectedBoardId: snapshot.selectedBoardId,
    voiceSampleUrl: snapshot.voiceSampleUrl,
    voiceUploadRefText: snapshot.voiceUploadRefText,
    talkingMode: snapshot.talkingMode,
    headshotImageUrl: snapshot.headshotImageUrl,
    headshotName: snapshot.headshotName,
    headshotPresetId: snapshot.selectedHeadshotPresetId,
    backgroundVideoId: snapshot.backgroundVideoId,
    captionsEnabled: snapshot.captionsEnabled,
    consentAcknowledged: snapshot.consent,
  }
}

function formBackgroundFromManifest(manifest: VideoManifest): string {
  if (
    manifest.talkingMode === "half" &&
    manifest.backgroundVideoId &&
    manifest.backgroundVideoId !== "none"
  ) {
    return manifest.backgroundVideoId
  }
  return "minecraft"
}

/**
 * When the browser can decode the file, re-encode to JPEG under the byte target.
 * Throws if decoding fails (e.g. HEIC on unsupported browsers) so the server can normalize.
 */
async function compressHeadshotToJpegInBrowser(file: File): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      URL.revokeObjectURL(url)
      resolve(el)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    el.src = url
  })

  const originalW = img.naturalWidth || img.width
  const originalH = img.naturalHeight || img.height

  let scale = Math.min(1, Math.sqrt(DID_HEADSHOT_TARGET_BYTES / Math.max(1, file.size)))
  let quality = 0.92
  let lastBlob: Blob | null = null

  for (let attempt = 0; attempt < 8; attempt++) {
    const maxDim = 1280
    const baseScale = Math.min(1, maxDim / Math.max(originalW, originalH))
    const effectiveScale = Math.min(scale, baseScale)

    const w = Math.max(1, Math.round(originalW * effectiveScale))
    const h = Math.max(1, Math.round(originalH * effectiveScale))

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    })

    if (blob) {
      lastBlob = blob
      if (blob.size <= DID_HEADSHOT_TARGET_BYTES) break
    }

    scale *= 0.9
    quality *= 0.85
  }

  if (!lastBlob) throw new Error("Could not compress image")

  const base = file.name.replace(/\.\w+$/, "")
  return new File([lastBlob], `${base}.jpg`, { type: "image/jpeg" })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Could not read image"))
    el.src = src
  })
}

import {
  BACKGROUND_OPTIONS,
  backgroundVideoIdForManifest,
  formatBackgroundForDisplay,
} from "@/lib/video/backgrounds"

type Stage = "form" | "credit_gate" | "generating" | "done"

type GenerationFailure = {
  message: string
  kind: VideoGenerationErrorKind
}

type CreditGateState = {
  manifestId: string
  balance: number
  required: number
}

function generationErrorKindFromCode(code?: string | null): VideoGenerationErrorKind {
  return code === "GENERATION_CAPABILITY_UNAVAILABLE" ? "capability_unavailable" : "error"
}

function throwGenerationFailure(message: string, code?: string | null): never {
  throw { message, kind: generationErrorKindFromCode(code) } satisfies GenerationFailure
}

type VoiceUploadStage = "idle" | "processing" | "uploading" | "uploaded"

type TtsAvailability = {
  replicate: boolean
  elevenlabs: boolean
  elevenlabsPresetVoicesReady?: boolean
}

async function deleteVoiceSampleOnServer(url: string) {
  await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
}

interface Props {
  boards: SoundboardManifest[]
  categories: VoicePresetCategory[]
  presets: VoicePresetPublic[]
}

export function NewVideoForm({ boards, categories, presets }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn } = useUser()
  const { openSignIn } = useClerk()

  const [stage, setStage] = useState<Stage>("form")
  const [error, setError] = useState("")
  const [generationErrorKind, setGenerationErrorKind] =
    useState<VideoGenerationErrorKind>("error")
  const [creditGate, setCreditGate] = useState<CreditGateState | null>(null)

  const [progressStep, setProgressStep] = useState<string | null>(null)
  const [progressPct, setProgressPct] = useState<number | null>(null)
  const [progressDetail, setProgressDetail] = useState<string | null>(null)

  const [videoTitle, setVideoTitle] = useState("")
  const [script, setScript] = useState("")
  const [voiceKind, setVoiceKind] = useState<VoiceKind>(
    presets.length > 0 ? "preset" : "board"
  )
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    presets[0]?.id ?? null
  )
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? "")
  const [ttsAvail, setTtsAvail] = useState<TtsAvailability | null>(null)

  // Voice upload state
  const [voiceUploadStage, setVoiceUploadStage] = useState<VoiceUploadStage>("idle")
  const [voiceSampleUrl, setVoiceSampleUrl] = useState("")
  const [voiceSamplePreviewUrl, setVoiceSamplePreviewUrl] = useState("")
  const [voiceSampleDuration, setVoiceSampleDuration] = useState(0)
  const [voiceSampleName, setVoiceSampleName] = useState("")
  const [voiceUploadRefText, setVoiceUploadRefText] = useState("")
  const [voiceUploadError, setVoiceUploadError] = useState("")
  const [removingVoiceSample, setRemovingVoiceSample] = useState(false)
  const voiceFileInputRef = useRef<HTMLInputElement>(null)
  const [backgroundVideoId, setBackgroundVideoId] = useState("minecraft")
  const selectedPreset = presets.find((p) => p.id === selectedPresetId)
  const selectedBoard = boards.find((b) => b.id === selectedBoardId)

  useEffect(() => {
    fetch("/api/tts-availability")
      .then((r) => r.json())
      .then((j) => setTtsAvail(j as TtsAvailability))
      .catch(() => setTtsAvail(null))
  }, [])

  useEffect(() => {
    const boardId = searchParams.get("soundboardId")?.trim()
    if (!boardId || !boards.some((b) => b.id === boardId)) return

    setVoiceKind("board")
    setSelectedBoardId(boardId)

    const titleParam = searchParams.get("title")?.trim()
    if (titleParam) setVideoTitle(titleParam.slice(0, 100))
  }, [searchParams, boards])

  const filteredPresets = useMemo(() => {
    if (categoryFilter === "all") return presets
    return presets.filter((p) => p.categoryId === categoryFilter)
  }, [presets, categoryFilter])

  const videoExportBananaCredits = useMemo(
    () => videoGenerationCostBananaCredits(script.length),
    [script.length]
  )

  useEffect(() => {
    const active = filteredPresets.filter((p) => p.status === "active")
    if (active.length === 0) {
      setSelectedPresetId(null)
      return
    }
    setSelectedPresetId((cur) =>
      cur && active.some((p) => p.id === cur)
        ? cur
        : active[0]!.id
    )
  }, [filteredPresets])
  const [talkingMode, setTalkingMode] = useState<"full" | "half">("full")
  const [headshotImageUrl, setHeadshotImageUrl] = useState("")
  const [headshotPreviewUrl, setHeadshotPreviewUrl] = useState("")
  const [headshotName, setHeadshotName] = useState("")
  const [headshotUploading, setHeadshotUploading] = useState(false)
  /** Shown while headshot is busy (checking face vs uploading). */
  const [headshotBusyLabel, setHeadshotBusyLabel] = useState<string | null>(null)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [consent, setConsent] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [selectedHeadshotPresetId, setSelectedHeadshotPresetId] = useState<string | null>(null)
  const [headshotDragActive, setHeadshotDragActive] = useState(false)
  const [voiceDragActive, setVoiceDragActive] = useState(false)
  const headshotInputRef = useRef<HTMLInputElement>(null)
  /** Tracks the active blob preview so we only revoke on replace/unmount. */
  const headshotBlobRef = useRef<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftManifestId, setDraftManifestId] = useState<string | null>(null)
  const draftManifestIdRef = useRef<string | null>(null)
  const draftSaveInFlightRef = useRef(false)

  const headshotDisplayUrl = useMemo(
    () => resolveHeadshotDisplayUrl(headshotPreviewUrl, headshotImageUrl, selectedHeadshotPresetId),
    [headshotPreviewUrl, headshotImageUrl, selectedHeadshotPresetId]
  )

  const draftPayloadRef = useRef<FormDraftSnapshot>({
    wizardStep: 1,
    videoTitle: "",
    script: "",
    voiceKind: presets.length > 0 ? "preset" : "board",
    selectedPresetId: presets[0]?.id ?? null,
    selectedBoardId: boards[0]?.id ?? "",
    voiceSampleUrl: "",
    voiceUploadRefText: "",
    talkingMode: "full",
    headshotImageUrl: "",
    headshotName: "",
    selectedHeadshotPresetId: null,
    backgroundVideoId: "minecraft",
    captionsEnabled: true,
    consent: false,
  })

  useEffect(() => {
    draftManifestIdRef.current = draftManifestId
  }, [draftManifestId])

  useEffect(() => {
    draftPayloadRef.current = {
      wizardStep,
      videoTitle,
      script,
      voiceKind,
      selectedPresetId,
      selectedBoardId,
      voiceSampleUrl,
      voiceUploadRefText,
      talkingMode,
      headshotImageUrl,
      headshotName,
      selectedHeadshotPresetId,
      backgroundVideoId,
      captionsEnabled,
      consent,
    }
  }, [
    wizardStep,
    videoTitle,
    script,
    voiceKind,
    selectedPresetId,
    selectedBoardId,
    voiceSampleUrl,
    voiceUploadRefText,
    talkingMode,
    headshotImageUrl,
    headshotName,
    selectedHeadshotPresetId,
    backgroundVideoId,
    captionsEnabled,
    consent,
  ])

  const persistServerDraft = useCallback(
    async (manifestId: string | null): Promise<string | null> => {
      if (!isSignedIn || draftSaveInFlightRef.current) return manifestId
      const body = buildServerDraftPayload(draftPayloadRef.current, manifestId)
      if (!hasVideoDraftContent(body)) return manifestId

      draftSaveInFlightRef.current = true
      try {
        const result = await upsertVideoDraft(body)
        if (!result?.id) return manifestId
        if (result.id !== manifestId) {
          setDraftManifestId(result.id)
          draftManifestIdRef.current = result.id
          router.replace(videoEditHref(result.id), { scroll: false })
        }
        return result.id
      } finally {
        draftSaveInFlightRef.current = false
      }
    },
    [isSignedIn, router]
  )

  const flushServerDraft = useCallback(() => {
    if (!isSignedIn) return
    const body = buildServerDraftPayload(
      draftPayloadRef.current,
      draftManifestIdRef.current
    )
    if (!hasVideoDraftContent(body)) return
    void fetch("/api/video/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
  }, [isSignedIn])

  useEffect(() => {
    const startFresh = searchParams.get("new") === "1"
    const soundboardId = searchParams.get("soundboardId")?.trim()
    const draftId = searchParams.get("id")?.trim()

    if (startFresh) {
      setDraftManifestId(null)
      draftManifestIdRef.current = null
      router.replace("/app/video/new", { scroll: false })
      setDraftReady(true)
      return
    }

    if (soundboardId) {
      setDraftManifestId(null)
      draftManifestIdRef.current = null
      setDraftReady(true)
      return
    }

    if (!draftId || !isSignedIn) {
      setDraftReady(true)
      return
    }

    let cancelled = false
    void loadVideoDraftManifest(draftId).then((manifest) => {
      if (cancelled) return
      if (!manifest || manifest.status !== "draft") {
        setDraftReady(true)
        return
      }

      setDraftManifestId(manifest.id)
      draftManifestIdRef.current = manifest.id
      setWizardStep(manifest.wizardStep ?? 1)
      setVideoTitle(manifest.title)
      setScript(manifest.script)
      if (manifest.soundboardId) {
        setVoiceKind("board")
        setSelectedBoardId(manifest.soundboardId)
      } else if (manifest.voicePresetId) {
        setVoiceKind("preset")
        setSelectedPresetId(manifest.voicePresetId)
      } else if (manifest.voiceId?.startsWith("http")) {
        setVoiceKind("upload")
        setVoiceSampleUrl(manifest.voiceId)
        setVoiceSampleName("Voice sample")
        setVoiceUploadStage("uploaded")
      }
      setVoiceUploadRefText(manifest.voiceRefText ?? "")
      setTalkingMode(manifest.talkingMode)
      setHeadshotImageUrl(manifest.headshotImageUrl)
      setSelectedHeadshotPresetId(manifest.headshotPresetId ?? null)
      if (manifest.headshotImageUrl) {
        if (manifest.headshotPresetId) {
          const preset = HEADSHOT_PRESETS.find((p) => p.id === manifest.headshotPresetId)
          if (preset) {
            setHeadshotName(preset.displayName)
            setHeadshotPreviewUrl(headshotPresetImageSrc(preset))
          } else if (!isPrivateVercelBlobUrlClient(manifest.headshotImageUrl)) {
            setHeadshotPreviewUrl(manifest.headshotImageUrl)
            setHeadshotName(manifest.title)
          }
        } else {
          if (!isPrivateVercelBlobUrlClient(manifest.headshotImageUrl)) {
            setHeadshotPreviewUrl(manifest.headshotImageUrl)
          }
          setHeadshotName(manifest.title)
        }
      } else {
        setHeadshotName("")
      }
      setBackgroundVideoId(formBackgroundFromManifest(manifest))
      setCaptionsEnabled(manifest.captionsEnabled !== false)
      setConsent(manifest.consentAcknowledged)
      setDraftReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [router, searchParams, isSignedIn])

  useEffect(() => {
    if (!draftReady || stage !== "form" || !isSignedIn) return

    const timer = window.setTimeout(() => {
      void persistServerDraft(draftManifestIdRef.current)
    }, 400)

    return () => window.clearTimeout(timer)
  }, [
    draftReady,
    stage,
    isSignedIn,
    persistServerDraft,
    wizardStep,
    videoTitle,
    script,
    voiceKind,
    selectedPresetId,
    selectedBoardId,
    voiceSampleUrl,
    voiceUploadRefText,
    talkingMode,
    headshotImageUrl,
    headshotName,
    selectedHeadshotPresetId,
    backgroundVideoId,
    captionsEnabled,
    consent,
  ])

  useEffect(() => {
    if (!draftReady || stage !== "form" || !isSignedIn) return

    window.addEventListener("pagehide", flushServerDraft)
    return () => {
      window.removeEventListener("pagehide", flushServerDraft)
      flushServerDraft()
    }
  }, [draftReady, stage, isSignedIn, flushServerDraft])

  useEffect(() => {
    const onTourStep = (e: Event) => {
      const { stepId, page } = (e as CustomEvent<TourStepChangedDetail>).detail
      if (page !== "/app/video/new") return

      const nextStep = TOUR_VIDEO_WIZARD_STEP[stepId]
      if (nextStep) setWizardStep(nextStep)

      const notifyReady = () => {
        window.dispatchEvent(
          new CustomEvent(WIZARD_STEP_READY_EVENT, {
            detail: { stepId },
          })
        )
      }
      // Double rAF so the wizard panel mounts before the tour measures spotlight.
      requestAnimationFrame(() => {
        requestAnimationFrame(notifyReady)
      })
    }
    window.addEventListener(TOUR_STEP_CHANGED_EVENT, onTourStep)
    return () => window.removeEventListener(TOUR_STEP_CHANGED_EVENT, onTourStep)
  }, [])

  // Revoke voice preview object URL on unmount
  useEffect(() => {
    return () => {
      if (voiceSamplePreviewUrl) URL.revokeObjectURL(voiceSamplePreviewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSamplePreviewUrl])

  const canUsePresets = presets.length > 0
  const canUseBoards = boards.length > 0

  const voiceUploadBusy = voiceUploadStage === "processing" || voiceUploadStage === "uploading" || removingVoiceSample

  const voiceReady =
    voiceKind === "preset"
      ? Boolean(selectedPresetId && selectedPreset?.status === "active")
      : voiceKind === "board"
      ? Boolean(selectedBoardId && selectedBoard)
      : Boolean(voiceSampleUrl)

  async function processVoiceFile(file: File) {
    const prevUrl = voiceSampleUrl
    setVoiceUploadError("")
    setVoiceUploadStage("processing")

    let processedFile: File
    try {
      const trimmed = await trimAndEncodeAudio(file)
      const usedClientWav = trimmed !== file
      processedFile = usedClientWav
        ? new File([trimmed], file.name.replace(/\.\w+$/, ".wav"), { type: "audio/wav" })
        : file
    } catch (err) {
      setVoiceUploadError(err instanceof Error ? err.message : "Could not process audio")
      setVoiceUploadStage("idle")
      return
    }

    setVoiceUploadStage("uploading")
    const fd = new FormData()
    fd.append("file", processedFile)

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setVoiceSampleUrl(data.url)
      setVoiceSamplePreviewUrl(URL.createObjectURL(processedFile))
      setVoiceSampleDuration(data.durationSeconds)
      setVoiceSampleName(file.name)
      setVoiceUploadStage("uploaded")
      if (prevUrl && prevUrl !== data.url) {
        void deleteVoiceSampleOnServer(prevUrl).catch(() => {})
      }
    } catch (err) {
      setVoiceUploadError(err instanceof Error ? err.message : "Upload failed")
      setVoiceUploadStage("idle")
    }
  }

  function handleVoiceFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processVoiceFile(file).finally(() => {
      if (voiceFileInputRef.current) voiceFileInputRef.current.value = ""
    })
  }

  async function removeVoiceSample() {
    if (!voiceSampleUrl) return
    setVoiceUploadError("")
    setRemovingVoiceSample(true)
    try {
      await deleteVoiceSampleOnServer(voiceSampleUrl)
      if (voiceSamplePreviewUrl) URL.revokeObjectURL(voiceSamplePreviewUrl)
      setVoiceSampleUrl("")
      setVoiceSamplePreviewUrl("")
      setVoiceSampleName("")
      setVoiceSampleDuration(0)
      setVoiceUploadStage("idle")
      if (voiceFileInputRef.current) voiceFileInputRef.current.value = ""
    } catch (err) {
      setVoiceUploadError(err instanceof Error ? err.message : "Could not delete file")
    } finally {
      setRemovingVoiceSample(false)
    }
  }

  async function deleteHeadshotOnServer(url: string) {
    const res = await fetch("/api/headshot-upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? "Could not delete uploaded headshot")
    }
  }

  useEffect(() => {
    return () => {
      if (headshotBlobRef.current) {
        URL.revokeObjectURL(headshotBlobRef.current)
        headshotBlobRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!draftReady || !headshotImageUrl || selectedHeadshotPresetId) return
    if (!isPrivateVercelBlobUrlClient(headshotImageUrl)) return
    if (headshotPreviewUrl.startsWith("blob:")) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(headshotImageUrl)
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        headshotBlobRef.current = url
        setHeadshotPreviewUrl(url)
      } catch {
        // Generation still uses headshotImageUrl; preview may stay blank briefly.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [draftReady, headshotImageUrl, selectedHeadshotPresetId, headshotPreviewUrl])

  async function processHeadshotFile(
    file: File,
    meta?: { displayName?: string; presetId?: string | null }
  ) {
    setError("")
    setHeadshotUploading(true)

    const previousUrl = headshotImageUrl
    let blobUrlForRevoke: string | null = null
    let earlyUploadUrl: string | null = null

    try {
      let jpegFile: File | null = null
      try {
        jpegFile = await compressHeadshotToJpegInBrowser(file)
      } catch {
        jpegFile = null
      }

      setHeadshotBusyLabel("Checking photo…")

      let imgForValidation: HTMLImageElement

      if (jpegFile) {
        const url = URL.createObjectURL(jpegFile)
        blobUrlForRevoke = url
        try {
          imgForValidation = await loadImageElement(url)
        } catch (err) {
          URL.revokeObjectURL(url)
          blobUrlForRevoke = null
          setError(
            err instanceof Error
              ? err.message
              : "Could not check this photo. Try another image."
          )
          if (headshotInputRef.current) headshotInputRef.current.value = ""
          return
        }
      } else {
        setHeadshotBusyLabel("Preparing photo…")
        const fdEarly = new FormData()
        fdEarly.append("file", file)
        const earlyRes = await fetch("/api/headshot-upload", {
          method: "POST",
          body: fdEarly,
        })
        const earlyData = (await earlyRes.json()) as { error?: string; url?: string }
        if (!earlyRes.ok) {
          setError(earlyData.error ?? "Could not process that photo.")
          if (headshotInputRef.current) headshotInputRef.current.value = ""
          return
        }
        earlyUploadUrl = earlyData.url ?? ""
        const fetched = await fetch(earlyUploadUrl, { mode: "cors" })
        if (!fetched.ok) {
          await deleteHeadshotOnServer(earlyUploadUrl).catch(() => {})
          setError("Could not load the converted photo for a quick face check. Try again.")
          if (headshotInputRef.current) headshotInputRef.current.value = ""
          return
        }
        const normBlob = await fetched.blob()
        const vUrl = URL.createObjectURL(normBlob)
        blobUrlForRevoke = vUrl
        try {
          imgForValidation = await loadImageElement(vUrl)
        } catch (err) {
          URL.revokeObjectURL(vUrl)
          blobUrlForRevoke = null
          await deleteHeadshotOnServer(earlyUploadUrl).catch(() => {})
          setError(
            err instanceof Error
              ? err.message
              : "Could not check this photo. Try another image."
          )
          if (headshotInputRef.current) headshotInputRef.current.value = ""
          return
        }
      }

      const faceCheck = await validateHeadshotFace(imgForValidation)
      if (!faceCheck.ok) {
        setError(faceCheck.message)
        if (blobUrlForRevoke) {
          URL.revokeObjectURL(blobUrlForRevoke)
          blobUrlForRevoke = null
        }
        if (earlyUploadUrl) await deleteHeadshotOnServer(earlyUploadUrl).catch(() => {})
        if (headshotInputRef.current) headshotInputRef.current.value = ""
        return
      }

      if (blobUrlForRevoke) {
        URL.revokeObjectURL(blobUrlForRevoke)
        blobUrlForRevoke = null
      }

      let finalUrl: string
      if (earlyUploadUrl) {
        finalUrl = earlyUploadUrl
      } else {
        setHeadshotBusyLabel("Uploading…")
        const fd = new FormData()
        fd.append("file", jpegFile!)
        const res = await fetch("/api/headshot-upload", { method: "POST", body: fd })
        const data = (await res.json()) as { error?: string; url?: string }
        if (!res.ok) {
          setError(data.error ?? "Upload failed")
          setHeadshotImageUrl("")
          setHeadshotName("")
          setHeadshotPreviewUrl("")
          if (headshotInputRef.current) headshotInputRef.current.value = ""
          return
        }
        finalUrl = data.url ?? ""
      }

      setHeadshotImageUrl(finalUrl)
      setHeadshotName(meta?.displayName ?? file.name)
      setSelectedHeadshotPresetId(meta?.presetId ?? null)
      setHeadshotPreviewUrl((cur) => {
        if (headshotBlobRef.current) {
          URL.revokeObjectURL(headshotBlobRef.current)
          headshotBlobRef.current = null
        } else if (cur.startsWith("blob:")) {
          URL.revokeObjectURL(cur)
        }
        if (meta?.presetId) {
          const preset = HEADSHOT_PRESETS.find((p) => p.id === meta.presetId)
          if (preset) return headshotPresetImageSrc(preset)
        }
        if (jpegFile && isPrivateVercelBlobUrlClient(finalUrl)) {
          const blobUrl = URL.createObjectURL(jpegFile)
          headshotBlobRef.current = blobUrl
          return blobUrl
        }
        return finalUrl
      })

      if (previousUrl && previousUrl !== finalUrl) {
        void deleteHeadshotOnServer(previousUrl).catch(() => {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Headshot upload failed")
      setHeadshotImageUrl("")
      setHeadshotName("")
      setSelectedHeadshotPresetId(null)
      setHeadshotPreviewUrl((cur) => {
        if (headshotBlobRef.current) {
          URL.revokeObjectURL(headshotBlobRef.current)
          headshotBlobRef.current = null
        } else if (cur.startsWith("blob:")) {
          URL.revokeObjectURL(cur)
        }
        return ""
      })
      if (headshotInputRef.current) headshotInputRef.current.value = ""
    } finally {
      if (blobUrlForRevoke) URL.revokeObjectURL(blobUrlForRevoke)
      setHeadshotBusyLabel(null)
      setHeadshotUploading(false)
    }
  }

  function handleHeadshotFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void processHeadshotFile(file, {
      displayName: file.name,
      presetId: null,
    }).finally(() => {
      if (headshotInputRef.current) headshotInputRef.current.value = ""
    })
  }

  async function applyHeadshotPreset(preset: HeadshotPreset) {
    setError("")
    try {
      const src = headshotPresetImageSrc(preset)
      const res = await fetch(src)
      if (!res.ok) {
        setError("Could not load that preset image. Try another preset or upload your own photo.")
        return
      }
      const blob = await res.blob()
      const ext = blob.type.includes("png") ? "png" : "jpeg"
      const file = new File([blob], `${preset.id}.${ext}`, {
        type: blob.type || "image/jpeg",
      })
      await processHeadshotFile(file, {
        displayName: preset.displayName,
        presetId: preset.id,
      })
    } catch {
      setError("Could not load preset image. Try upload instead.")
    }
  }

  async function removeHeadshot() {
    if (!headshotImageUrl) return
    setError("")
    setHeadshotUploading(true)

    const urlToDelete = headshotImageUrl

    try {
      await deleteHeadshotOnServer(urlToDelete).catch(() => {})
    } finally {
      setHeadshotImageUrl("")
      setHeadshotName("")
      setSelectedHeadshotPresetId(null)
      setHeadshotPreviewUrl("")
      if (headshotBlobRef.current) {
        URL.revokeObjectURL(headshotBlobRef.current)
        headshotBlobRef.current = null
      }
      if (headshotInputRef.current) headshotInputRef.current.value = ""
      setHeadshotUploading(false)
    }
  }

  const openCreditGate = useCallback(
    (manifestId: string, balance: number, required: number) => {
      setDraftManifestId(manifestId)
      draftManifestIdRef.current = manifestId
      setCreditGate({ manifestId, balance, required })
      setStage("credit_gate")
    },
    []
  )

  const runGenerationPipeline = useCallback(async (createdId: string) => {
    setCreditGate(null)
    setError("")
    setGenerationErrorKind("error")

    let genHttpError: GenerationFailure | null = null
    let postGenBananaBalance: number | undefined
    const genPromise = fetch(`/api/video/${createdId}/generate`, { method: "POST" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (r.status === 402) {
          const o = j as {
            code?: string
            balance?: number
            required?: number
            error?: string
          }
          if (o.code === "INSUFFICIENT_BANANA_CREDITS") {
            openCreditGate(
              createdId,
              typeof o.balance === "number" ? o.balance : 0,
              typeof o.required === "number"
                ? o.required
                : videoGenerationCostBananaCredits(script.length)
            )
            return null
          }
        }
        if (!r.ok) {
          const o = j as { error?: string; detail?: string; code?: string }
          const msg = [o.error, o.detail].filter(Boolean).join(" — ")
          throwGenerationFailure(msg || "Generation failed", o.code)
        }
        const o = j as { id?: string; bananaCreditsBalance?: number }
        if (typeof o.bananaCreditsBalance === "number") postGenBananaBalance = o.bananaCreditsBalance
        return o
      })
      .catch((e) => {
        if (e && typeof e === "object" && "message" in e && "kind" in e) {
          genHttpError = e as GenerationFailure
          return
        }
        genHttpError = {
          message: e instanceof Error ? e.message : String(e),
          kind: "error",
        }
      })

    const genResult = await genPromise
    if (genResult === null) return

    setStage("generating")

    let completed = false
    for (let attempt = 0; attempt < 900; attempt++) {
      if (genHttpError) throw genHttpError
      const statusRes = await fetch(`/api/video/${createdId}/status`, { method: "GET" })
      const statusJson = (await statusRes.json().catch(() => null)) as
        | {
            status?: string
            videoUrl?: string | null
            progressStep?: string | null
            progressPct?: number | null
            progressDetail?: string | null
            lastError?: string | null
            lastErrorCode?: string | null
          }
        | null

      if (statusJson) {
        setProgressStep(statusJson.progressStep ?? null)
        setProgressPct(typeof statusJson.progressPct === "number" ? statusJson.progressPct : null)
        setProgressDetail(statusJson.progressDetail ?? null)
        if (statusJson.lastError) {
          throwGenerationFailure(statusJson.lastError, statusJson.lastErrorCode)
        }
        if (statusJson.status === "complete") {
          completed = true
          break
        }
        if (statusJson.status === "failed") {
          throwGenerationFailure(
            statusJson.lastError ?? "Generation failed",
            statusJson.lastErrorCode
          )
        }
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    if (!completed) {
      void genPromise.catch(() => {})
      throw new Error(
        "Generation is taking longer than expected. Check your videos list for this item, or try again in a few minutes."
      )
    }

    await genPromise
    if (typeof postGenBananaBalance === "number") {
      emitBananaCreditsUpdated(postGenBananaBalance)
    }
    clearPendingGeneration()
    router.refresh()
    setStage("done")
    router.push(`/app/video/${createdId}`)
  }, [router, script.length, openCreditGate])

  const runGenerationPipelineRef = useRef(runGenerationPipeline)
  runGenerationPipelineRef.current = runGenerationPipeline

  useEffect(() => {
    const onResume = (e: Event) => {
      const d = (e as CustomEvent<PendingGenerationResumeDetail>).detail
      if (d.product !== "video") return
      void runGenerationPipelineRef.current(d.manifestId)
    }
    window.addEventListener(PENDING_GENERATION_RESUME_EVENT, onResume)
    return () => window.removeEventListener(PENDING_GENERATION_RESUME_EVENT, onResume)
  }, [])

  async function handleGenerate() {
    setError("")
    setGenerationErrorKind("error")
    setCreditGate(null)
    if (!isSignedIn) {
      openSignIn()
      return
    }
    if (!videoTitle.trim()) return setError("Enter a name for this video.")
    if (!script.trim()) return setError("Enter a script.")
    if (voiceKind === "upload" && !voiceSampleUrl) return setError("Upload a voice sample first.")
    if (!voiceReady) return setError("Select a voice.")
    if (voiceKind === "preset" && selectedPreset?.status !== "active") {
      return setError("This preset is coming soon. Please choose an active preset.")
    }
    if (!consent) return setError("You must acknowledge the consent checkbox.")
    if (!headshotImageUrl) return setError("Upload a headshot photo.")
    if (voiceKind === "preset" && ttsAvail && !ttsAvail.elevenlabs) {
      return setError(
        "Preset voices require ElevenLabs. Add the ElevenLabs API key or use a soundboard with Replicate."
      )
    }
    if (voiceKind === "preset" && ttsAvail?.elevenlabsPresetVoicesReady === false) {
      return setError(
        "Preset video voices need every VOICE_PRESET_*_PROVIDER_ID set in Vercel (see your .env.example). Add those env vars or use a soundboard / upload flow instead."
      )
    }
    if (voiceKind === "upload" && ttsAvail && !ttsAvail.elevenlabs) {
      return setError(
        "Uploaded voice requires ElevenLabs. Add the ElevenLabs API key or use a soundboard voice."
      )
    }

    try {
      const sharedFields = {
        title: videoTitle.trim(),
        script: script.trim(),
        backgroundVideoId: backgroundVideoIdForManifest(talkingMode, backgroundVideoId),
        headshotImageUrl,
        talkingMode,
        captionsEnabled,
        consentAcknowledged: true as const,
        ...(selectedHeadshotPresetId ? { headshotPresetId: selectedHeadshotPresetId } : {}),
        ...(draftManifestId ? { replaceDraftId: draftManifestId } : {}),
      }

      const createBody =
        voiceKind === "preset"
          ? {
              ...sharedFields,
              voicePresetId: selectedPresetId!,
              ttsTier: "elevenlabs" as const,
            }
          : voiceKind === "upload"
          ? {
              ...sharedFields,
              voiceId: voiceSampleUrl,
              ttsTier: "elevenlabs" as const,
              ...(voiceUploadRefText.trim() ? { voiceRefText: voiceUploadRefText.trim() } : {}),
            }
          : {
              ...sharedFields,
              soundboardId: selectedBoard!.id,
              ...(selectedBoard?.voiceRefText?.trim()
                ? { voiceRefText: selectedBoard.voiceRefText.trim() }
                : {}),
            }

      const createRes = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error ?? "Failed to create video")

      const createdId = String(created.id)
      setDraftManifestId(createdId)
      draftManifestIdRef.current = createdId
      const cost = videoGenerationCostBananaCredits(script.length)
      const entRes = await fetch("/api/billing/entitlement")
      if (entRes.ok) {
        const ent = (await entRes.json()) as { bananaCreditsBalance?: number }
        const balance =
          typeof ent.bananaCreditsBalance === "number" ? ent.bananaCreditsBalance : 0
        if (balance < cost) {
          openCreditGate(createdId, balance, cost)
          return
        }
      }
      await runGenerationPipeline(createdId)
    } catch (err) {
      if (err && typeof err === "object" && "message" in err && "kind" in err) {
        const failure = err as GenerationFailure
        setError(failure.message)
        setGenerationErrorKind(failure.kind)
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong")
        setGenerationErrorKind("error")
      }
      setStage("form")
    }
  }

  if (stage === "credit_gate" && creditGate) {
    return (
      <CreditGateScreen
        product="video"
        balance={creditGate.balance}
        required={creditGate.required}
        manifestId={creditGate.manifestId}
        returnPath={
          draftManifestId ? videoEditHref(draftManifestId) : "/app/video/new"
        }
        alternateHref="/app/soundboard/new"
        alternateLabel="Try soundboard (1 credit)"
        onBack={() => {
          clearPendingGeneration()
          setCreditGate(null)
          setStage("form")
        }}
      />
    )
  }

  if (stage === "generating") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background px-4 py-6 pt-4">
        <div className="mx-auto w-full max-w-lg flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Generating Video</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your video is being created. This may take a few minutes — please keep this screen open.
            </p>
          </div>
          <VideoGeneratingCard
            progressStep={progressStep}
            progressPct={progressPct}
            progressDetail={progressDetail}
            lastError={error || null}
            errorKind={generationErrorKind}
          />
          {error && (
            <p
              className={
                generationErrorKind === "capability_unavailable"
                  ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
                  : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              }
            >
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const noVoicesAtAll = false // upload tab is always available

  const step1Ready =
    Boolean(headshotImageUrl) && !headshotUploading && voiceReady && !voiceUploadBusy
  const step2Ready = Boolean(videoTitle.trim()) && Boolean(script.trim())
  const canGenerate =
    isSignedIn === false ||
    (!noVoicesAtAll && step1Ready && step2Ready && consent)

  function goToWizardStep(step: WizardStep) {
    setError("")
    setWizardStep(step)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleWizardNext() {
    if (wizardStep === 1 && !step1Ready) {
      if (!headshotImageUrl) setError("Add a headshot — pick a preset or upload a photo.")
      else if (!voiceReady) setError("Select a voice to continue.")
      return
    }
    if (wizardStep === 2 && !step2Ready) {
      if (!videoTitle.trim()) setError("Enter a name for this video.")
      else setError("Write a script for your video.")
      return
    }
    setError("")
    goToWizardStep((wizardStep + 1) as WizardStep)
  }

  function handleWizardBack() {
    setError("")
    goToWizardStep((wizardStep - 1) as WizardStep)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-32 lg:pb-24">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Video</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wizardStep === 1 && "Pick who appears and how they sound."}
            {wizardStep === 2 && "Name your video and write what they say."}
            {wizardStep === 3 && "Pick how the video is framed, then background, captions, and generate."}
          </p>
        </div>
        <VideoWizardStepper
          current={wizardStep}
          onStepClick={(step) => {
            if (step === 1) goToWizardStep(1)
            else if (step === 2 && step1Ready) goToWizardStep(2)
          }}
        />
      </div>
      {noVoicesAtAll && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 space-y-2">
          <p className="font-medium">No voices configured</p>
          <p className="text-xs">Add presets to the catalog or create a soundboard.</p>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/app/soundboard/new">
              <Mic2 className="mr-1.5 h-3.5 w-3.5" />
              Create soundboard <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}

      {canUsePresets && !canUseBoards && (
        <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
          Tip: create a{" "}
          <Link href="/app/soundboard/new" className="text-primary underline">
            soundboard
          </Link>{" "}
          to use your own voice sample for videos.
        </div>
      )}

      {wizardStep === 1 && (
        <>
      {/* Step 1: Headshot */}
      <Card data-tour="video-headshot" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-4">
          <p className="text-sm font-medium">Headshot</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Pick a character preset or upload a front-facing photo.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Character presets</label>
            <div className="max-h-[min(240px,40vh)] overflow-y-auto pr-1 sm:max-h-[min(300px,45vh)]">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                {HEADSHOT_PRESETS.map((p) => {
                  const selected = selectedHeadshotPresetId === p.id && Boolean(headshotImageUrl)
                  const thumbSrc = headshotPresetImageSrc(p)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={headshotUploading}
                      onClick={() => void applyHeadshotPreset(p)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-colors",
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/35"
                          : "border-border/50 bg-card/40 hover:border-border"
                      )}
                    >
                      <img
                        src={thumbSrc}
                        alt=""
                        className="h-12 w-12 rounded-full border border-border/40 object-cover object-[center_22%] sm:h-14 sm:w-14"
                      />
                      <span className="line-clamp-2 text-[10px] font-medium leading-tight sm:text-xs">
                        {p.displayName}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Or upload / drag &amp; drop</label>
            <p className="text-xs text-muted-foreground/90">
              One clear, front-facing face (we verify before sending to the animator).
            </p>

            <input
              ref={headshotInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={handleHeadshotFileChange}
            />

            {headshotImageUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
                <img
                  src={headshotDisplayUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-lg border border-border/40 bg-secondary/30 object-cover object-[center_22%]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={headshotName}>
                    {headshotName || "Headshot"}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready to animate</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={headshotUploading}
                    onClick={() => headshotInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    disabled={headshotUploading}
                    onClick={() => void removeHeadshot()}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    headshotInputRef.current?.click()
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setHeadshotDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeadshotDragActive(false)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setHeadshotDragActive(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f && /^image\//i.test(f.type)) {
                    void processHeadshotFile(f, { displayName: f.name, presetId: null })
                  }
                }}
                onClick={() => !headshotUploading && headshotInputRef.current?.click()}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
                  headshotDragActive && !headshotUploading
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60",
                  headshotUploading && "pointer-events-none opacity-50"
                )}
              >
                <ImageIcon className="h-6 w-6" />
                <span>
                  {headshotUploading
                    ? headshotBusyLabel ?? "Working…"
                    : "Drop an image here or click to browse"}
                </span>
                <span className="text-xs opacity-70">
                  JPG, PNG, WebP, HEIC, GIF… · max ~25 MB · converted to JPEG automatically
                </span>
              </div>
            )}
          </div>

          <MoreOptions>
            <p>
              Some face types aren&apos;t supported yet — if that happens, try another preset or your own
              photo. We verify every image before sending it to the animator.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
              {HEADSHOT_PRESETS.slice(0, 6).map((p) => (
                <p key={p.id} className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">{p.displayName}</span> — {p.tagline}
                </p>
              ))}
            </div>
          </MoreOptions>
        </CardContent>
      </Card>

      {/* Step 1: Voice */}
      <Card data-tour="video-voice-tabs" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">Voice</p>

          {/* Three-way tab bar: stacked on narrow screens so labels are not crushed */}
          <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-secondary/20 p-1 sm:flex-row sm:gap-0 sm:p-0.5">
            <button
              type="button"
              disabled={!canUsePresets}
              onClick={() => setVoiceKind("preset")}
              className={[
                "flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:flex-1 sm:justify-center sm:gap-1.5 sm:py-2 sm:text-xs",
                voiceKind === "preset"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                !canUsePresets ? "opacity-40 pointer-events-none" : "",
              ].join(" ")}
            >
              <Sparkles className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
              Preset voices
            </button>
            <button
              type="button"
              disabled={!canUseBoards}
              onClick={() => setVoiceKind("board")}
              className={[
                "flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:flex-1 sm:justify-center sm:gap-1.5 sm:py-2 sm:text-xs",
                voiceKind === "board"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                !canUseBoards ? "opacity-40 pointer-events-none" : "",
              ].join(" ")}
            >
              <Mic2 className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
              My soundboards
            </button>
            <button
              type="button"
              onClick={() => setVoiceKind("upload")}
              className={[
                "flex w-full items-center justify-start gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:flex-1 sm:justify-center sm:gap-1.5 sm:py-2 sm:text-xs",
                voiceKind === "upload"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Upload className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
              Upload voice
            </button>
          </div>

          {/* Preset voices panel */}
          {voiceKind === "preset" && canUsePresets && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tap a card to select it and hear a short preview. Tap again to stop.
              </p>
              <div className="filter-tabs flex gap-2 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={[
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    categoryFilter === "all"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  ].join(" ")}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.description}
                    onClick={() => setCategoryFilter(c.id)}
                    className={[
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      categoryFilter === c.id
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-border",
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div data-tour="video-preset-grid" className="preset-scroll max-h-[min(420px,55vh)] overflow-y-auto pr-2">
                <div className="grid grid-cols-3 gap-3">
                  {filteredPresets.map((p) => {
                    const selected = selectedPresetId === p.id
                    const comingSoon = p.status !== "active"
                    return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={comingSoon}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (comingSoon) return
                      setSelectedPresetId(p.id)
                      toggleOrPlayPresetPreview(p.id)
                    }}
                    className={[
                      "flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                        : "border-border/50 bg-card/40 hover:border-border",
                      comingSoon ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <div className="relative mx-auto">
                      <img
                        src={p.imageSrc}
                        alt=""
                        className="h-14 w-14 rounded-full border border-border/40 bg-secondary/30 object-contain p-2"
                      />
                      {selected && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {p.label}
                        {comingSoon ? " · Coming soon" : ""}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.tagline}</p>
                    </div>
                  </button>
                    )
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/10 px-3 py-2 text-xs text-muted-foreground sm:hidden">
                Preset voices use ElevenLabs — fastest option.
              </div>
              <MoreOptions className="hidden sm:block">
                <p>
                  Preset voices use <span className="font-medium text-foreground">ElevenLabs</span>. Use{" "}
                  <span className="text-foreground">My soundboards</span> for Replicate F5.
                </p>
              </MoreOptions>
            </div>
          )}

          {/* My soundboards panel */}
          {voiceKind === "board" && canUseBoards && (
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title} — {board.speakerLabel}
                </option>
              ))}
            </select>
          )}

          {/* Upload voice panel */}
          {voiceKind === "upload" && (
            <div className="space-y-3">
              {/* Slower-generation notice */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-200/90">
                  Your sample is cloned via ElevenLabs Instant Voice Clone, then used to generate the video. Takes a bit longer than preset voices — usually a few extra minutes.
                </p>
              </div>

              <input
                ref={voiceFileInputRef}
                type="file"
                className="hidden"
                onChange={handleVoiceFileChange}
              />

              {voiceSampleUrl && voiceUploadStage === "uploaded" ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={voiceSampleName}>
                      {voiceSampleName || "Voice sample"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {voiceSampleDuration > 0
                        ? `${voiceSampleDuration.toFixed(1)}s · Ready`
                        : "Uploaded"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={voiceUploadBusy}
                      onClick={() => voiceFileInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      disabled={voiceUploadBusy || removingVoiceSample}
                      onClick={removeVoiceSample}
                    >
                      {removingVoiceSample ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (voiceUploadBusy) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      voiceFileInputRef.current?.click()
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!voiceUploadBusy) setVoiceDragActive(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setVoiceDragActive(false)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setVoiceDragActive(false)
                    if (voiceUploadBusy) return
                    const f = e.dataTransfer.files?.[0]
                    if (f) {
                      void processVoiceFile(f).finally(() => {
                        if (voiceFileInputRef.current) voiceFileInputRef.current.value = ""
                      })
                    }
                  }}
                  onClick={() => {
                    if (!voiceUploadBusy) voiceFileInputRef.current?.click()
                  }}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/10 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5",
                    voiceDragActive && !voiceUploadBusy && "border-primary bg-primary/10",
                    voiceUploadBusy && "pointer-events-none opacity-60"
                  )}
                >
                  {voiceUploadBusy ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {voiceUploadStage === "processing" ? "Processing audio…" : "Uploading…"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Drop audio/video here or click to browse</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          MP3, WAV, M4A, or video with audio · 6–60 sec · 15 MB max
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {voiceUploadError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {voiceUploadError}
                </p>
              )}

              {/* Optional preview playback */}
              {voiceSamplePreviewUrl && (
                <audio src={voiceSamplePreviewUrl} controls className="h-8 w-full" />
              )}

              <MoreOptions>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Reference transcript <span className="font-normal opacity-70">(optional)</span>
                  </label>
                  <textarea
                    value={voiceUploadRefText}
                    onChange={(e) => setVoiceUploadRefText(e.target.value)}
                    placeholder="Paste what the voice sample is saying…"
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Improves rhythm and pronunciation when the sample is someone speaking clearly.
                  </p>
                </div>
              </MoreOptions>
            </div>
          )}

          {!canUsePresets && !canUseBoards && voiceKind !== "upload" && (
            <p className="text-xs text-muted-foreground">No voice sources available.</p>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {wizardStep === 2 && (
      <Card data-tour="video-script" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-4">
          <p className="text-sm font-medium">Script</p>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Video name</label>
            <input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Minecraft rant, birthday roast"
              maxLength={100}
              className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Start from a template</label>
            <div className="filter-tabs flex gap-2 overflow-x-auto pb-0.5">
              {SCRIPT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScript(t.text)}
                  className="shrink-0 rounded-full border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Script</label>
            <div className="relative">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Write what you want the AI to say in your video…"
                maxLength={2000}
                rows={8}
                className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none"
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {script.length}/2000
              </span>
            </div>
          </div>

          <MoreOptions>
            <p>Video name is shown on your dashboard and share links — it is not read aloud.</p>
            <p className="flex flex-wrap items-center gap-1.5">
              Base rate includes the first 500 characters; each additional 500 (or part) adds 1 banana
              credit. Estimated cost for this script:{" "}
              <span className="inline-flex items-center gap-1 text-foreground/90">
                {formatCurrencyCost(videoExportBananaCredits)}
                <NextImage
                  src={currencyIconSrc()}
                  alt={currencyIconAlt()}
                  width={12}
                  height={12}
                  className="inline-block shrink-0"
                />
              </span>
            </p>
          </MoreOptions>
        </CardContent>
      </Card>
      )}

      {wizardStep === 3 && (
        <>
      <Card data-tour="video-layout" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <div>
            <p className="text-sm font-medium">Video layout</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Where your character sits in the frame — not the script or voice.
            </p>
          </div>
          <LayoutOptionPicker value={talkingMode} onChange={setTalkingMode} />
        </CardContent>
      </Card>
      <Card data-tour="video-background" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <div>
            <p className="text-sm font-medium">Background clip</p>
            {talkingMode === "half" ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                The gameplay video that plays under your character in split layout.
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Only used in split layout — switch above to pick a background clip.
              </p>
            )}
          </div>
          {talkingMode === "half" ? (
            <div className="grid grid-cols-2 gap-3">
              {BACKGROUND_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackgroundVideoId(bg.id)}
                  className={[
                    "rounded-xl border-2 p-3 text-left transition-colors sm:p-4",
                    backgroundVideoId === bg.id
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border/80",
                  ].join(" ")}
                >
                  <div
                    className="mb-2 h-8 w-8 rounded-lg"
                    style={{ backgroundColor: bg.color }}
                  />
                  <p className="text-sm font-medium">{bg.label}</p>
                  <p className="text-xs text-muted-foreground">{bg.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border/40 bg-secondary/10 px-3 py-2.5 text-xs text-muted-foreground">
              Full-screen layout has no background clip — your character takes up the whole frame.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-tour="video-captions" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">Captions</p>
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/20">
            <button
              type="button"
              onClick={() => setCaptionsEnabled(true)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-xs font-medium transition-colors sm:py-2",
                captionsEnabled
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Captions on
            </button>
            <button
              type="button"
              onClick={() => setCaptionsEnabled(false)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-xs font-medium transition-colors sm:py-2",
                !captionsEnabled
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Captions off
            </button>
          </div>
          <MoreOptions>
            <p>Full-screen talking head places captions at the bottom when enabled.</p>
          </MoreOptions>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/50">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-3">Consent</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-muted-foreground leading-snug">
              {voiceKind === "preset" ? (
                <>
                  I understand preset voices are provided for entertainment and I am responsible
                  for how I use generated video. Misuse may result in takedown and account
                  suspension.
                </>
              ) : (
                <>
                  I confirm that I have the consent and/or rights to use this voice for this
                  video. I understand that misuse may result in takedown and account suspension.
                </>
              )}
            </span>
          </label>
        </CardContent>
      </Card>

      <MoreOptions label="Review selections">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            Video name:{" "}
            <span className="text-foreground">{videoTitle.trim() || "Not set"}</span>
          </p>
          <p>
            Script:{" "}
            <span className="text-foreground">
              {script.trim()
                ? `${script.trim().slice(0, 80)}${script.trim().length > 80 ? "..." : ""}`
                : "Not set"}
            </span>
          </p>
          <p>
            Voice:{" "}
            <span className="text-foreground">
              {voiceKind === "preset"
                ? selectedPreset
                  ? `Preset — ${selectedPreset.label}`
                  : "Preset — none"
                : voiceKind === "upload"
                  ? voiceSampleUrl
                    ? `Upload — ${voiceSampleName || "sample"}`
                    : "Upload — none"
                  : selectedBoard
                    ? `Soundboard — ${selectedBoard.title}`
                    : "Soundboard — none"}
            </span>
          </p>
          <p>
            Headshot: <span className="text-foreground">{headshotName || "Not set"}</span>
          </p>
          <p>
            Layout:{" "}
            <span className="text-foreground">
              {talkingMode === "half" ? "Split screen" : "Full screen"}
            </span>
          </p>
          <p>
            Background:{" "}
            <span className="text-foreground">
              {formatBackgroundForDisplay(talkingMode, backgroundVideoId)}
            </span>
          </p>
          <p>
            Captions:{" "}
            <span className="text-foreground">{captionsEnabled ? "On" : "Off"}</span>
          </p>
        </div>
      </MoreOptions>
        </>
      )}

      {error && (
        <p
          className={
            generationErrorKind === "capability_unavailable"
              ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
              : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {error}
        </p>
      )}

      <VideoWizardFooter
        step={wizardStep}
        canGoNext={wizardStep === 1 ? step1Ready : step2Ready}
        canGenerate={canGenerate}
        creditCost={videoExportBananaCredits}
        nextLabel={wizardStep === 1 ? "Continue to script" : "Continue to look"}
        onBack={handleWizardBack}
        onNext={handleWizardNext}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
