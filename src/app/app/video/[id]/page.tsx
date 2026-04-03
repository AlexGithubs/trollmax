import { notFound, redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, AlertCircle, Info } from "lucide-react"
import type { SoundboardManifest, VideoManifest } from "@/lib/manifests/types"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import { VideoShareLink } from "@/components/video/VideoShareLink"
import { DeleteVideoButton } from "@/components/video/DeleteVideoButton"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Video ${id} — TROLLMAX` }
}

const STATUS_BADGE: Record<VideoManifest["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-yellow-500/20 text-yellow-600" },
  complete: { label: "Complete", className: "bg-green-500/20 text-green-600" },
  failed: { label: "Failed", className: "bg-destructive/20 text-destructive" },
}

export default async function ManageVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)
  if (!raw) notFound()

  const manifest = JSON.parse(raw) as VideoManifest
  if (manifest.ownerId !== user.id) notFound()

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const shareUrl = `${baseUrl}/v/${id}`

  const badge = STATUS_BADGE[manifest.status]
  const sourceBoardRaw = manifest.soundboardId
    ? await store.get(`soundboard:${manifest.soundboardId}`)
    : null
  const sourceBoard = sourceBoardRaw ? (JSON.parse(sourceBoardRaw) as SoundboardManifest) : null
  const voiceSourceLabel = manifest.voicePresetId
    ? `Preset (${manifest.voicePresetId})`
    : sourceBoard
      ? `Soundboard (${sourceBoard.title})`
      : /^https?:\/\//i.test(manifest.voiceId)
        ? "Sample voice"
        : "Cloned voice ID"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/app/video">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{manifest.title}</h1>
          <p className="text-xs text-muted-foreground">{manifest.backgroundVideoId}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <details className="rounded-xl border border-border/50 bg-card/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Generation inputs
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1">Script:</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/40 bg-secondary/20 p-2 text-foreground">
              {manifest.script?.trim() || "N/A"}
            </pre>
          </div>
          <p>
            Voice source:{" "}
            <span className="text-foreground">{voiceSourceLabel}</span>
          </p>
          <p>
            Voice quality:{" "}
            <span className="text-foreground">
              {manifest.ttsTier === "elevenlabs" ? "Great (ElevenLabs)" : "Good (Replicate)"}
            </span>
          </p>
          <p>
            Background: <span className="text-foreground">{manifest.backgroundVideoId}</span>
          </p>
          <p>
            Layout:{" "}
            <span className="text-foreground">
              {manifest.talkingMode === "half" ? "Top half + background" : "Full screen"}
            </span>
          </p>
          <p>
            Ref transcript:{" "}
            <span className="text-foreground">{manifest.voiceRefText?.trim() ? "Provided" : "Not provided"}</span>
          </p>
          <p>
            Captions:{" "}
            <span className="text-foreground">{manifest.captionsEnabled === false ? "Off" : "On"}</span>
          </p>
        </div>
      </details>

      {manifest.status === "complete" && manifest.videoUrl && (
        <>
          <VideoShareLink shareUrl={shareUrl} />
          <VideoPlayer videoUrl={manifest.videoUrl} videoId={id} />
        </>
      )}

      {manifest.status === "processing" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Your video is being generated…</p>
          <p className="text-xs text-muted-foreground">Refresh the page to check progress.</p>
        </div>
      )}

      {manifest.status === "failed" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">Generation failed</p>
          <p className="text-xs text-muted-foreground">
            Something went wrong. Try creating a new video.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/video/new">Try again</Link>
          </Button>
        </div>
      )}

      {manifest.status === "draft" && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
          This video hasn&apos;t been generated yet.
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <DeleteVideoButton id={id} redirectTo="/app/video" />
      </div>
    </div>
  )
}
