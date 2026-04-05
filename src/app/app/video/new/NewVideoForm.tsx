"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser, useClerk } from "@clerk/nextjs"
import Link from "next/link"
import { emitBananaCreditsUpdated } from "@/lib/client/banana-credits-bridge"
import NextImage from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VideoGeneratingCard } from "@/components/video/VideoGeneratingCard"
import {
  Mic2,
  ArrowRight,
  Sparkles,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Info,
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

// D-ID is strict about image size; we target a safer ceiling before upload.
const DID_HEADSHOT_TARGET_BYTES = 9_000_000

/** Same rule as server `isPrivateVercelBlobUrl` — private blob URLs are not usable as `<img src>`. */
function isPrivateVercelBlobUrlClient(url: string): boolean {
  return (
    url.includes("blob.vercel-storage.com") &&
    !url.includes(".public.blob.vercel-storage.com")
  )
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

const BACKGROUNDS = [
  {
    id: "minecraft",
    label: "Minecraft",
    color: "#2d5a1b",
    description: "Forest green gameplay",
  },
  {
    id: "subway-surfers",
    label: "Subway Surfers",
    color: "#e8721a",
    description: "Orange runner background",
  },
]

type Stage = "form" | "generating" | "done"

type VoiceKind = "preset" | "board" | "upload"

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
  const { isSignedIn } = useUser()
  const { openSignIn } = useClerk()

  const [stage, setStage] = useState<Stage>("form")
  const [error, setError] = useState("")

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
  const selectedBackground = BACKGROUNDS.find((b) => b.id === backgroundVideoId)

  useEffect(() => {
    fetch("/api/tts-availability")
      .then((r) => r.json())
      .then((j) => setTtsAvail(j as TtsAvailability))
      .catch(() => setTtsAvail(null))
  }, [])

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
  const headshotInputRef = useRef<HTMLInputElement>(null)

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

  async function handleVoiceFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
      if (headshotPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(headshotPreviewUrl)
    }
  }, [headshotPreviewUrl])

  async function handleHeadshotFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

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
      setHeadshotName(file.name)
      setHeadshotPreviewUrl((cur) => {
        if (cur.startsWith("blob:")) URL.revokeObjectURL(cur)
        if (jpegFile && isPrivateVercelBlobUrlClient(finalUrl)) {
          return URL.createObjectURL(jpegFile)
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
      setHeadshotPreviewUrl((cur) => {
        if (cur.startsWith("blob:")) URL.revokeObjectURL(cur)
        return ""
      })
      if (headshotInputRef.current) headshotInputRef.current.value = ""
    } finally {
      if (blobUrlForRevoke) URL.revokeObjectURL(blobUrlForRevoke)
      setHeadshotBusyLabel(null)
      setHeadshotUploading(false)
    }
  }

  async function removeHeadshot() {
    if (!headshotImageUrl) return
    setError("")
    setHeadshotUploading(true)

    const urlToDelete = headshotImageUrl
    const previewToRevoke = headshotPreviewUrl

    try {
      await deleteHeadshotOnServer(urlToDelete).catch(() => {})
    } finally {
      setHeadshotImageUrl("")
      setHeadshotName("")
      setHeadshotPreviewUrl("")
      if (previewToRevoke.startsWith("blob:")) URL.revokeObjectURL(previewToRevoke)
      if (headshotInputRef.current) headshotInputRef.current.value = ""
      setHeadshotUploading(false)
    }
  }

  async function handleGenerate() {
    setError("")
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

    setStage("generating")

    try {
      const sharedFields = {
        title: videoTitle.trim(),
        script: script.trim(),
        backgroundVideoId,
        headshotImageUrl,
        talkingMode,
        captionsEnabled,
        consentAcknowledged: true as const,
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

      // Fire generation request but drive UI by polling status.
      let genHttpError: Error | null = null
      let postGenBananaBalance: number | undefined
      const genPromise = fetch(`/api/video/${createdId}/generate`, { method: "POST" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}))
          if (!r.ok) {
            const o = j as { error?: string; detail?: string }
            const msg = [o.error, o.detail].filter(Boolean).join(" — ")
            throw new Error(msg || "Generation failed")
          }
          const o = j as { id?: string; bananaCreditsBalance?: number }
          if (typeof o.bananaCreditsBalance === "number") postGenBananaBalance = o.bananaCreditsBalance
          return o
        })
        .catch((e) => {
          genHttpError = e instanceof Error ? e : new Error(String(e))
        })

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
            }
          | null

        if (statusJson) {
          setProgressStep(statusJson.progressStep ?? null)
          setProgressPct(typeof statusJson.progressPct === "number" ? statusJson.progressPct : null)
          setProgressDetail(statusJson.progressDetail ?? null)
          if (statusJson.lastError) throw new Error(statusJson.lastError)
          if (statusJson.status === "complete") {
            completed = true
            break
          }
          if (statusJson.status === "failed") throw new Error(statusJson.lastError ?? "Generation failed")
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
      router.refresh()
      setStage("done")
      router.push(`/app/video/${createdId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStage("form")
    }
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
          />
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const noVoicesAtAll = false // upload tab is always available

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name your video, write a script, pick a voice, choose headshot + layout, then finalize options and
          generate.
        </p>
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

      {/* Step 1: Name & script */}
      <Card data-tour="video-script" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">1. Name &amp; script</p>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Video name</label>
            <input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Minecraft rant, birthday roast"
              maxLength={100}
              className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on your dashboard and share links (not read aloud).
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Script</label>
            <div className="relative">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Write what you want the AI to say in your video…"
                maxLength={2000}
                rows={6}
                className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none"
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {script.length}/2000
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
              <span>
                Base rate includes the first 500 characters; each additional 500 (or part) adds 1
                banana credit.
              </span>
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
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Voice */}
      <Card data-tour="video-voice-tabs" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">2. Voice</p>

          {/* Three-way tab bar */}
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/20">
            <button
              type="button"
              disabled={!canUsePresets}
              onClick={() => setVoiceKind("preset")}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                voiceKind === "preset"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                !canUsePresets ? "opacity-40 pointer-events-none" : "",
              ].join(" ")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Preset voices
            </button>
            <button
              type="button"
              disabled={!canUseBoards}
              onClick={() => setVoiceKind("board")}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                voiceKind === "board"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                !canUseBoards ? "opacity-40 pointer-events-none" : "",
              ].join(" ")}
            >
              <Mic2 className="h-3.5 w-3.5" />
              My soundboards
            </button>
            <button
              type="button"
              onClick={() => setVoiceKind("upload")}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                voiceKind === "upload"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Upload className="h-3.5 w-3.5" />
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
              <div className="rounded-lg border border-border/50 bg-secondary/10 px-3 py-2 text-xs text-muted-foreground">
                Preset voices use <span className="font-medium text-foreground">ElevenLabs</span>. Use <span className="text-foreground">My soundboards</span> for Replicate F5.
              </div>
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
                <button
                  type="button"
                  disabled={voiceUploadBusy}
                  onClick={() => voiceFileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/10 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
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
                        <p className="text-sm font-medium">Click to upload voice sample</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          MP3, WAV, M4A, or video with audio · 6–60 sec · 15 MB max
                        </p>
                      </div>
                    </>
                  )}
                </button>
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

              {/* Reference transcript */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Reference transcript <span className="font-normal opacity-70">(optional — improves similarity)</span>
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
                  If your sample is someone saying "Hey everyone, welcome back to my channel…", paste that here. The model uses it to match rhythm and pronunciation.
                </p>
              </div>
            </div>
          )}

          {!canUsePresets && !canUseBoards && voiceKind !== "upload" && (
            <p className="text-xs text-muted-foreground">No voice sources available.</p>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Talking head */}
      <Card data-tour="video-headshot" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">3. Talking head</p>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Headshot photo</label>
              <p className="text-xs text-muted-foreground/90">
                Use one clear, front-facing face that fills a good part of the frame (we check this before
                upload).
              </p>

              <input
                ref={headshotInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handleHeadshotFileChange}
              />

              {headshotPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <img
                    src={headshotPreviewUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg border border-border/40 bg-secondary/30 object-cover"
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
                <button
                  type="button"
                  onClick={() => headshotInputRef.current?.click()}
                  disabled={headshotUploading}
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-8 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="h-6 w-6" />
                  <span>
                    {headshotUploading
                      ? headshotBusyLabel ?? "Working…"
                      : "Click to upload headshot"}
                  </span>
                  <span className="text-xs opacity-70">
                    JPG, PNG, WebP, HEIC, GIF… · max ~25 MB · converted to JPEG automatically
                  </span>
                </button>
              )}
            </div>

            <div data-tour="video-layout" className="space-y-2">
              <label className="text-xs text-muted-foreground">Layout</label>
              <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/20">
                <button
                  type="button"
                  onClick={() => setTalkingMode("full")}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                    talkingMode === "full"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Full screen
                </button>
                <button
                  type="button"
                  onClick={() => setTalkingMode("half")}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                    talkingMode === "half"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Top half + background
                </button>
              </div>

              {talkingMode === "half" ? (
                <p className="text-xs text-muted-foreground">
                  The talking head will animate on the top half; the selected background stays on the bottom.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Background is ignored in full-screen mode.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Background */}
      <Card data-tour="video-background" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">4. Background</p>
          {talkingMode === "half" ? (
            <div className="grid grid-cols-2 gap-3">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setBackgroundVideoId(bg.id)}
                  className={[
                    "rounded-xl border-2 p-4 text-left transition-colors",
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
            <p className="text-xs text-muted-foreground">
              Full-screen mode is selected, so background is not used.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 5: Captions */}
      <Card data-tour="video-captions" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">5. Captions</p>
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/20">
            <button
              type="button"
              onClick={() => setCaptionsEnabled(true)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
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
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                !captionsEnabled
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Captions off
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Full-screen talking head places captions at the bottom when enabled.
          </p>
        </CardContent>
      </Card>

      {/* Step 6: Consent */}
      <Card className="border-border/60 bg-card/50">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-3">6. Consent</p>
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

      <Card className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Current selections</p>
            <span title="Quick check of the values that will be sent when you click Generate.">
              <Info className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              Video name:{" "}
              <span className="text-foreground">
                {videoTitle.trim() || "Not set"}
              </span>
            </p>
            <p>
              Script:{" "}
              <span className="text-foreground">
                {script.trim() ? `${script.trim().slice(0, 80)}${script.trim().length > 80 ? "..." : ""}` : "Not set"}
              </span>
            </p>
            <p>
              Voice source:{" "}
              <span className="text-foreground">
                {voiceKind === "preset"
                  ? selectedPreset
                    ? `Preset - ${selectedPreset.label}`
                    : "Preset - none selected"
                  : voiceKind === "upload"
                  ? voiceSampleUrl
                    ? `Upload - ${voiceSampleName || "sample"}`
                    : "Upload - not uploaded"
                  : selectedBoard
                    ? `Soundboard - ${selectedBoard.title}`
                    : "Soundboard - none selected"}
              </span>
            </p>
            <p>
              Voice quality:{" "}
              <span className="text-foreground">
                {voiceKind === "preset"
                  ? "Great (ElevenLabs)"
                  : selectedBoard?.ttsTier === "elevenlabs"
                    ? "Great (ElevenLabs via board)"
                    : "Good (Replicate via board)"}
              </span>
            </p>
            <p>
              Background: <span className="text-foreground">{selectedBackground?.label ?? backgroundVideoId}</span>
            </p>
            <p>
              Layout:{" "}
              <span className="text-foreground">
                {talkingMode === "half" ? "Top half + background" : "Full screen"}
              </span>
            </p>
            <p>
              Captions:{" "}
              <span className="text-foreground">{captionsEnabled ? "On" : "Off"}</span>
            </p>
            <p>
              Headshot: <span className="text-foreground">{headshotName || "Not uploaded"}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        data-tour="video-generate-btn"
        onClick={handleGenerate}
        disabled={
          isSignedIn === false
            ? false
            : noVoicesAtAll ||
              !videoTitle.trim() ||
              !script.trim() ||
              !voiceReady ||
              !consent ||
              !headshotImageUrl ||
              headshotUploading ||
              voiceUploadBusy
        }
        className="group h-14 w-full justify-between rounded-2xl px-5 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:shadow-none"
        size="lg"
      >
        <span className="tracking-tight">
          Generate Video
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-sm font-bold backdrop-blur-sm">
          <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-7 w-7 object-contain" />
          2
        </span>
      </Button>
    </div>
  )
}
