"use client"

import { useState, useRef, useEffect, useMemo, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { useUser, useClerk } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { TourOfferBanner } from "@/components/onboarding/TourOfferBanner"
import { Card, CardContent } from "@/components/ui/card"
import {
  Upload,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Check,
  Sparkles,
  Lock,
  Info,
} from "lucide-react"
import { trimAndEncodeAudio } from "@/lib/audio/trim-and-encode"
import { GeneratingCard } from "@/components/soundboard/GeneratingCard"
import { toggleOrPlayPresetPreview } from "@/lib/voice-presets/preset-preview-client"
import type {
  VoicePresetPublic,
  VoicePresetCategory,
} from "@/lib/voice-presets/catalog"
import { currencyIconAlt, currencyIconSrc } from "@/lib/billing/currency-display"

const DEFAULT_PHRASES = [
  "Hello there",
  "Oh no no no",
  "Not today Satan",
  "No cap fr fr",
  "That's lowkey bussin",
  "Main character energy",
]

type Stage = "idle" | "processing" | "uploading" | "uploaded" | "generating" | "done"

type VoiceMode = "upload" | "preset"

type BillingEntitlement = {
  maxPhrases: number
  maxPhraseChars: number
  baseMaxPhrases: number
  baseMaxPhraseChars: number
  soundboardCount: number
  maxSoundboards: number
  atSoundboardLimit: boolean
}

async function deleteSampleOnServer(url: string) {
  const res = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "Could not delete uploaded file")
  }
}

export default function NewSoundboardPage() {
  const router = useRouter()
  const { isSignedIn } = useUser()
  const { openSignIn } = useClerk()

  const [ent, setEnt] = useState<BillingEntitlement | null>(null)

  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState("")
  const [removingSample, setRemovingSample] = useState(false)

  const [voiceMode, setVoiceMode] = useState<VoiceMode>("upload")
  const [categories, setCategories] = useState<VoicePresetCategory[]>([])
  const [presets, setPresets] = useState<VoicePresetPublic[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)

  const filteredPresets = useMemo(() => {
    if (categoryFilter === "all") return presets
    return presets.filter((p) => p.categoryId === categoryFilter)
  }, [presets, categoryFilter])
  const selectedPreset = presets.find((p) => p.id === selectedPresetId)

  // Step 1 — upload
  const [sampleUrl, setSampleUrl] = useState("")
  const [samplePreviewUrl, setSamplePreviewUrl] = useState("") // local object URL for in-page preview
  const [sampleDuration, setSampleDuration] = useState(0)
  const [sampleName, setSampleName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => { if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl) }
  }, [samplePreviewUrl])

  // Step 2 — phrases + title
  const [title, setTitle] = useState("")
  const [speakerLabel, setSpeakerLabel] = useState("")
  const [phrases, setPhrases] = useState<string[]>(DEFAULT_PHRASES)

  // Step 3 — consent
  const [consent, setConsent] = useState(false)
  // Optional ref transcript (improves zero-shot similarity)
  const [voiceRefText, setVoiceRefText] = useState("")

  type TtsTier = "replicate" | "elevenlabs"
  type TtsAvailability = {
    replicate: boolean
    elevenlabs: boolean
    elevenlabsPresetVoicesReady?: boolean
  }
  const [ttsTier, setTtsTier] = useState<TtsTier>("elevenlabs")
  const [ttsAvail, setTtsAvail] = useState<TtsAvailability | null>(null)

  const [genId, setGenId] = useState<string | null>(null)
  const [progressStep, setProgressStep] = useState<string | null>(null)
  const [progressPct, setProgressPct] = useState<number | null>(null)
  const [progressDetail, setProgressDetail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/tts-availability")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setTtsAvail(j as TtsAvailability)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      voiceMode === "preset" &&
      ttsAvail?.elevenlabsPresetVoicesReady === false &&
      ttsTier === "elevenlabs" &&
      ttsAvail.replicate
    ) {
      setTtsTier("replicate")
    }
  }, [voiceMode, ttsAvail, ttsTier])

  useEffect(() => {
    let cancelled = false
    fetch("/api/voice-presets")
      .then((r) => r.json())
      .then(
        (d: { presets?: VoicePresetPublic[]; categories?: VoicePresetCategory[] }) => {
          if (cancelled) return
          if (Array.isArray(d.presets)) setPresets(d.presets)
          if (Array.isArray(d.categories)) setCategories(d.categories)
        }
      )
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/billing/entitlement")
      .then((r) => r.json())
      .then((d: Partial<BillingEntitlement> & { error?: string }) => {
        if (cancelled || d.error) return
        setEnt({
          maxPhrases: typeof d.maxPhrases === "number" ? d.maxPhrases : 6,
          maxPhraseChars: typeof d.maxPhraseChars === "number" ? d.maxPhraseChars : 70,
          baseMaxPhrases: typeof d.baseMaxPhrases === "number" ? d.baseMaxPhrases : 6,
          baseMaxPhraseChars: typeof d.baseMaxPhraseChars === "number" ? d.baseMaxPhraseChars : 70,
          soundboardCount: typeof d.soundboardCount === "number" ? d.soundboardCount : 0,
          maxSoundboards: typeof d.maxSoundboards === "number" ? d.maxSoundboards : 50,
          atSoundboardLimit: Boolean(d.atSoundboardLimit),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (voiceMode !== "preset" || filteredPresets.length === 0) return
    const active = filteredPresets.filter((p) => p.status === "active")
    if (active.length === 0) {
      setSelectedPresetId(null)
      return
    }
    setSelectedPresetId((cur) =>
      cur && active.some((p) => p.id === cur) ? cur : active[0]!.id
    )
  }, [voiceMode, filteredPresets])

  useEffect(() => {
    if (voiceMode !== "preset" || !selectedPresetId) return
    const pr = presets.find((p) => p.id === selectedPresetId)
    if (pr) setSpeakerLabel(pr.defaultSpeakerLabel)
  }, [voiceMode, selectedPresetId, presets])

  function selectPreset(id: string) {
    const p = presets.find((x) => x.id === id)
    if (!p || p.status !== "active") return
    setSelectedPresetId(id)
    setSpeakerLabel(p.defaultSpeakerLabel)
  }

  function presetLockedForTier(p: (typeof presets)[number]) {
    return false
  }

  function onPresetCardInteract(
    p: (typeof presets)[number],
    e: MouseEvent<HTMLButtonElement>
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (busy || p.status !== "active") return
    selectPreset(p.id)
    toggleOrPlayPresetPreview(p.id)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const previousSampleUrl = sampleUrl
    setError("")
    setStage("processing")

    let processedFile: File
    try {
      const trimmed = await trimAndEncodeAudio(file)
      // When the browser can't decode (e.g. some video codecs), we upload the original for server-side handling.
      const usedClientWav = trimmed !== file
      processedFile = usedClientWav
        ? new File([trimmed], file.name.replace(/\.\w+$/, ".wav"), {
            type: "audio/wav",
          })
        : file
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process audio")
      setStage("idle")
      return
    }

    setStage("uploading")
    const fd = new FormData()
    fd.append("file", processedFile)

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setSampleUrl(data.url)
      setSamplePreviewUrl(URL.createObjectURL(processedFile))
      setSampleDuration(data.durationSeconds)
      setSampleName(file.name)
      setStage("uploaded")
      if (previousSampleUrl && previousSampleUrl !== data.url) {
        void deleteSampleOnServer(previousSampleUrl).catch(() => {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setStage("idle")
    }
  }

  async function removeSample() {
    if (!sampleUrl) return
    setError("")
    setRemovingSample(true)
    try {
      await deleteSampleOnServer(sampleUrl)
      if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl)
      setSampleUrl("")
      setSamplePreviewUrl("")
      setSampleName("")
      setSampleDuration(0)
      setStage("idle")
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete file")
    } finally {
      setRemovingSample(false)
    }
  }

  function addPhrase() {
    if (phrases.length >= maxPhrases) return
    setPhrases((p) => [...p, ""])
  }

  function updatePhrase(i: number, v: string) {
    setPhrases((p) => p.map((x, j) => (j === i ? v : x)))
  }

  function removePhrase(i: number) {
    setPhrases((p) => p.filter((_, j) => j !== i))
  }

  async function handleGenerate() {
    setError("")
    if (!isSignedIn) {
      openSignIn()
      return
    }
    if (atSoundboardLimit) {
      return setError("Soundboard limit reached. Delete a board to continue.")
    }
    const validPhrases = phrases.filter((p) => p.trim().length > 0)
    if (voiceMode === "upload" && !sampleUrl) return setError("Upload a voice sample first.")
    if (voiceMode === "preset" && !selectedPresetId) return setError("Choose a preset voice.")
    if (voiceMode === "preset" && selectedPreset?.status !== "active") {
      return setError("This preset is coming soon. Please choose an active preset.")
    }
    const selectedPresetObj = presets.find((x) => x.id === selectedPresetId)
    if (voiceMode === "preset" && selectedPresetObj && presetLockedForTier(selectedPresetObj)) {
      return setError("This preset is not available right now.")
    }
    if (!title.trim()) return setError("Enter a title.")
    if (voiceMode === "upload" && !speakerLabel.trim()) return setError("Enter a speaker name.")
    if (validPhrases.length === 0) return setError("Add at least one phrase.")
    if (!consent) return setError("You must acknowledge the consent checkbox.")
    if (ttsAvail) {
      const ok =
        (ttsTier === "replicate" && ttsAvail.replicate) ||
        (ttsTier === "elevenlabs" && ttsAvail.elevenlabs)
      if (!ok) {
        return setError(
          "Selected voice quality is not configured. Pick another tier or add API keys."
        )
      }
      if (
        voiceMode === "preset" &&
        ttsTier === "elevenlabs" &&
        ttsAvail.elevenlabsPresetVoicesReady === false
      ) {
        return setError(
          "Preset voices need ElevenLabs voice IDs on the server. In Vercel, set every VOICE_PRESET_*_PROVIDER_ID from your env template, or use Good (Replicate) for presets until those are configured."
        )
      }
    }

    setStage("generating")

    try {
      const body =
        voiceMode === "preset"
          ? {
              title: title.trim(),
              voicePresetId: selectedPresetId!,
              ttsTier,
              phrases: validPhrases,
              consentAcknowledged: true as const,
              ...(voiceRefText.trim() ? { voiceRefText: voiceRefText.trim() } : {}),
            }
          : {
              title: title.trim(),
              speakerLabel: speakerLabel.trim(),
              voiceSampleUrl: sampleUrl,
              ttsTier,
              phrases: validPhrases,
              consentAcknowledged: true as const,
              ...(voiceRefText.trim() ? { voiceRefText: voiceRefText.trim() } : {}),
            }

      const createRes = await fetch("/api/soundboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error ?? "Failed to create soundboard")

      const createdId = String(created.id)
      setGenId(createdId)

      // Fire generation request but drive UI by polling status.
      let genHttpError: Error | null = null
      const genPromise = fetch(`/api/soundboard/${createdId}/generate`, { method: "POST" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error((j as { error?: string }).error ?? "Generation failed")
          return j as { id?: string }
        })
        .catch((e) => {
          genHttpError = e instanceof Error ? e : new Error(String(e))
        })

      let completed = false
      for (let attempt = 0; attempt < 900; attempt++) {
        if (genHttpError) throw genHttpError
        // 15 minutes max, but usually far less.
        const statusRes = await fetch(`/api/soundboard/${createdId}/status`, { method: "GET" })
        const statusJson = (await statusRes.json().catch(() => null)) as
          | {
              status?: string
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
          "Generation is taking longer than expected. Check your soundboards list for this board, or try again in a few minutes."
        )
      }

      await genPromise
      setStage("done")
      router.push(`/app/soundboard/${createdId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStage(voiceMode === "preset" ? "idle" : "uploaded")
    }
  }

  const busy =
    stage === "processing" || stage === "uploading" || stage === "generating" || removingSample
  const validPhraseCount = phrases.filter((p) => p.trim().length > 0).length

  const maxPhrases = ent?.maxPhrases ?? 6
  const maxPhraseChars = ent?.maxPhraseChars ?? 70
  const baseMaxPhrases = ent?.baseMaxPhrases ?? 6
  const baseMaxPhraseChars = ent?.baseMaxPhraseChars ?? 70
  const atSoundboardLimit = ent?.atSoundboardLimit ?? false
  const requiresExpansion =
    phrases.length > baseMaxPhrases || phrases.some((phrase) => phrase.length > baseMaxPhraseChars)
  const generationCost = requiresExpansion ? 1.5 : 1

  const voiceReady =
    voiceMode === "upload"
      ? Boolean(sampleUrl)
      : Boolean(selectedPresetId && selectedPreset?.status === "active")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <TourOfferBanner page="/app/soundboard/new" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Soundboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your own sample or pick a preset voice, add phrases, and generate.
        </p>
      </div>

      {atSoundboardLimit && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          You&apos;re at your soundboard limit ({ent?.soundboardCount ?? "?"}/{ent?.maxSoundboards ?? "?"}).
          Delete a board from the list to continue.
        </div>
      )}
      {/* Step 1: Voice source */}
      <Card data-tour="sb-voice-source" className="border-border/60 bg-card/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-medium">1. Voice</p>
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/20">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setVoiceMode("upload")
                setSelectedPresetId(null)
              }}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                voiceMode === "upload"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload audio
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setVoiceMode("preset")
                if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl)
                setSampleUrl("")
                setSamplePreviewUrl("")
                setSampleName("")
                setSampleDuration(0)
                setStage("idle")
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                voiceMode === "preset"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Preset voices
            </button>
          </div>

          {voiceMode === "preset" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tap a card to select it and hear a short preview. Tap again to stop.
              </p>
              <div className="filter-tabs flex gap-2 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  disabled={busy}
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
                    disabled={busy}
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
              <div className="preset-scroll max-h-[min(420px,55vh)] overflow-y-auto pr-2">
                <div className="grid grid-cols-3 gap-3">
                  {filteredPresets.map((p) => {
                    const selected = selectedPresetId === p.id
                    const comingSoon = p.status !== "active"
                    const tierLock = presetLockedForTier(p)
                    return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busy || comingSoon}
                      onClick={(e) => onPresetCardInteract(p, e)}
                      className={[
                        "flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                          : "border-border/50 bg-card/40 hover:border-border",
                        comingSoon ? "opacity-60" : "",
                        tierLock ? "border-dashed border-muted-foreground/40" : "",
                      ].join(" ")}
                    >
                      <div className="relative mx-auto">
                        <img
                          src={p.imageSrc}
                          alt=""
                          className="h-14 w-14 rounded-full border border-border/40 bg-secondary/30 object-contain p-2"
                        />
                        {selected && !tierLock && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        {tierLock && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" />
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
              {selectedPresetId && (
                <p className="rounded-md border border-border/40 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground italic">
                  {selectedPreset?.placeholder}
                </p>
              )}
            </div>
          ) : sampleUrl ? (
            <div className="space-y-2">
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <span className="min-w-0 flex-1 truncate" title={sampleName}>
                  {sampleName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {sampleDuration.toFixed(1)}s
                </span>
              </div>
              {samplePreviewUrl && (
                <audio src={samplePreviewUrl} controls className="w-full h-8" />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Replace file
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void removeSample()}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {removingSample ? "Removing…" : "Remove sample"}
                </Button>
              </div>
              <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                Tip: best results with 10–20s of clear speech, minimal background noise, and a rough transcript below.
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-8 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {stage === "processing" ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Processing audio…</span>
                  </>
                ) : stage === "uploading" ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span>Click to upload audio</span>
                    <span className="text-xs opacity-70">
                      Best results with 10-20s of clear speech · audio or video (mp4, mov, …) · max 15 MB audio /
                      80 MB video · up to 60s
                    </span>
                  </>
                )}
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <div data-tour="sb-voice-quality" className="space-y-2 rounded-lg border border-border/50 bg-secondary/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Voice quality</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { id: "replicate" as const, label: "Good", hint: "Replicate F5" },
                  { id: "elevenlabs" as const, label: "Great", hint: "ElevenLabs" },
                ] as const
              ).map((opt) => {
                const presetBlocksEl =
                  voiceMode === "preset" && ttsAvail?.elevenlabsPresetVoicesReady === false
                const enabled =
                  !ttsAvail ||
                  (opt.id === "replicate" && ttsAvail.replicate) ||
                  (opt.id === "elevenlabs" && ttsAvail.elevenlabs && !presetBlocksEl)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy || !enabled}
                    onClick={() => setTtsTier(opt.id)}
                    className={[
                      "rounded-lg border px-2 py-2 text-left text-xs transition-colors",
                      ttsTier === opt.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/50 hover:border-border",
                      !enabled ? "cursor-not-allowed opacity-40" : "",
                    ].join(" ")}
                  >
                    <span className="block font-semibold">{opt.label}</span>
                    <span className="text-muted-foreground">{opt.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && stage === "idle" && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {stage === "generating" ? (
        <>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <GeneratingCard
            progressStep={progressStep}
            progressPct={progressPct}
            progressDetail={progressDetail}
            lastError={error || null}
          />
        </>
      ) : (
        <>
          {/* Step 2: Title + phrases */}
          <Card className="border-border/60 bg-card/50">
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm font-medium">2. Title &amp; phrases</p>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Board title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Soundboard"
                  maxLength={100}
                  disabled={busy}
                  className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Speaker name</label>
                <input
                  value={speakerLabel}
                  onChange={(e) => setSpeakerLabel(e.target.value)}
                  placeholder="e.g. My Friend Dave"
                  maxLength={80}
                  disabled={busy || voiceMode === "preset"}
                  className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60 disabled:opacity-50"
                />
                {voiceMode === "preset" && (
                  <p className="text-[11px] text-muted-foreground">
                    Locked to the selected preset for this board.
                  </p>
                )}
              </div>

              <div data-tour="sb-phrases" className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Phrases ({phrases.length}/{maxPhrases}) · up to {maxPhraseChars} characters each
                </label>
                {phrases.map((phrase, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={phrase}
                      onChange={(e) => updatePhrase(i, e.target.value)}
                      placeholder={`Phrase ${i + 1}`}
                      maxLength={maxPhraseChars}
                      disabled={busy}
                      className="flex-1 rounded-md border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm outline-none focus:border-primary/60 disabled:opacity-50"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePhrase(i)}
                      disabled={busy || phrases.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {phrases.length < maxPhrases && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={addPhrase}
                    disabled={busy}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add phrase
                  </Button>
                )}
                {requiresExpansion && (
                  <p className="text-[11px] leading-snug text-muted-foreground/75">
                    This board uses expanded phrases (+0.5{" "}
                    <img
                      src={currencyIconSrc()}
                      alt={currencyIconAlt()}
                      className="inline h-3.5 w-3.5 object-contain align-[-1px] opacity-90"
                    />{" "}
                    on top of the base generate).
                  </p>
                )}
                <details data-tour="sb-expansion" className="group rounded-md border border-border/30 bg-secondary/5 px-2.5 py-1.5 text-[11px] text-muted-foreground/65 open:border-border/50 open:bg-secondary/10">
                  <summary className="cursor-pointer list-none select-none marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="underline decoration-border/50 underline-offset-2 group-open:no-underline">
                      Going past {baseMaxPhrases} phrases or {baseMaxPhraseChars} characters per line?
                    </span>
                  </summary>
                  <p className="mt-1.5 pl-0.5 leading-snug text-muted-foreground/80">
                    More than {baseMaxPhrases} phrases, or any phrase over {baseMaxPhraseChars} characters,
                    adds +0.5{" "}
                    <img
                      src={currencyIconSrc()}
                      alt={currencyIconAlt()}
                      className="inline h-3.5 w-3.5 object-contain align-[-1px] opacity-90"
                    />{" "}
                    when you generate (on top of the base cost).
                  </p>
                </details>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Consent */}
          <Card className="border-border/60 bg-card/50">
            <CardContent className="pt-5">
              <p className="text-sm font-medium mb-3">3. Consent</p>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-muted-foreground leading-snug">
                  {voiceMode === "preset" ? (
                    <>
                      I understand preset voices are provided for entertainment and I am
                      responsible for how I use generated audio. Misuse may result in takedown
                      and account suspension.
                    </>
                  ) : (
                    <>
                      I confirm that I have the consent and/or rights to use this voice for this
                      soundboard. I understand that misuse may result in takedown and account
                      suspension.
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
                  Title: <span className="text-foreground">{title.trim() || "Not set"}</span>
                </p>
                <p>
                  Voice source:{" "}
                  <span className="text-foreground">
                    {voiceMode === "preset"
                      ? selectedPreset
                        ? `Preset - ${selectedPreset.label}`
                        : "Preset - none selected"
                      : sampleName
                        ? `Upload - ${sampleName}`
                        : "Upload - none"}
                  </span>
                </p>
                <p>
                  Voice quality:{" "}
                  <span className="text-foreground">
                    {ttsTier === "elevenlabs" ? "Great (ElevenLabs)" : "Good (Replicate)"}
                  </span>
                </p>
                <p>
                  Speaker:{" "}
                  <span className="text-foreground">
                    {speakerLabel.trim() || (voiceMode === "preset" ? "Preset default" : "Not set")}
                  </span>
                </p>
                <p>
                  Phrases: <span className="text-foreground">{validPhraseCount}</span>
                </p>
                <p>
                  Ref transcript:{" "}
                  <span className="text-foreground">{voiceRefText.trim() ? "Provided" : "Not provided"}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Optional: reference transcript */}
          {voiceMode === "upload" && (
            <Card data-tour="sb-ref-transcript" className="border-border/60 bg-card/50">
              <CardContent className="pt-5 space-y-2">
                <p className="text-sm font-medium">Optional: what did the sample say?</p>
                <p className="text-xs text-muted-foreground">
                  Adding a rough transcript of your uploaded voice sample improves cloning quality.
                </p>
                <textarea
                  value={voiceRefText}
                  onChange={(e) => setVoiceRefText(e.target.value)}
                  placeholder="Paste what the voice sample says (best effort)."
                  maxLength={1000}
                  rows={3}
                  disabled={busy}
                  className="w-full rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none disabled:opacity-50"
                />
                {!voiceRefText.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    If you skip this, the cloned voice is more likely to sound “off” or unstable.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {error && stage !== "idle" && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            data-tour="sb-generate-btn"
            onClick={handleGenerate}
            disabled={isSignedIn === false ? false : busy || !voiceReady || !consent || atSoundboardLimit}
            className="group h-14 w-full justify-between rounded-2xl px-5 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:shadow-none"
            size="lg"
          >
            <span className="tracking-tight">
              Generate Soundboard
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-sm font-bold backdrop-blur-sm">
              <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-7 w-7 object-contain" />
              {generationCost}
            </span>
          </Button>
        </>
      )}
    </div>
  )
}
