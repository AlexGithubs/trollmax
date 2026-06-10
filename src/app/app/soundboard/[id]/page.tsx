import { notFound, redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Info } from "lucide-react"
import type { SoundboardManifest } from "@/lib/manifests/types"
import {
  MANIFEST_STATUS_BADGE,
  resolveSoundboardStatus,
} from "@/lib/manifests/status-badge"
import { SoundboardPlayer } from "@/components/soundboard/SoundboardPlayer"
import { ShareMenu } from "@/components/share/ShareMenu"
import { SoundboardVideoUpsell } from "@/components/soundboard/SoundboardVideoUpsell"
import { DeleteBoardButton } from "@/components/soundboard/DeleteBoardButton"
import { RegenerateSoundboardButton } from "@/components/soundboard/RegenerateSoundboardButton"
import { ManifestStatusPoller } from "@/components/generation/ManifestStatusPoller"
import { getSiteBaseUrl } from "@/lib/site-url"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Soundboard ${id} — TROLLMAX` }
}

export default async function ManageSoundboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`soundboard:${id}`)
  if (!raw) notFound()

  const manifest = JSON.parse(raw) as SoundboardManifest
  if (manifest.ownerId !== user.id) notFound()

  const baseUrl = getSiteBaseUrl() ?? "http://localhost:3000"
  const shareUrl = `${baseUrl}/s/${id}`

  const status = resolveSoundboardStatus(manifest)
  const badge = MANIFEST_STATUS_BADGE[status]
  const hasClips = manifest.clips.length > 0
  const videoUpsellHref = hasClips
    ? `/app/video/new?${new URLSearchParams({
        soundboardId: id,
        title: `${manifest.title} video`,
      }).toString()}`
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0">
            <Link href="/app/soundboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{manifest.title}</h1>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{manifest.speakerLabel}</p>
          </div>
        </div>
        {status === "complete" && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <ShareMenu shareUrl={shareUrl} kind="soundboard" className="shrink-0" />
          </div>
        )}
      </div>

      <details className="rounded-xl border border-border/50 bg-card/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Generation inputs
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            Title: <span className="text-foreground">{manifest.title}</span>
          </p>
          <p>
            Speaker: <span className="text-foreground">{manifest.speakerLabel}</span>
          </p>
          <p>
            Voice source:{" "}
            <span className="text-foreground">
              {manifest.voicePresetId ? `Preset (${manifest.voicePresetId})` : "Uploaded sample"}
            </span>
          </p>
          <p>
            Voice quality:{" "}
            <span className="text-foreground">
              {manifest.ttsTier === "elevenlabs" ? "Great (ElevenLabs)" : "Good (Replicate)"}
            </span>
          </p>
          <p>
            Phrases: <span className="text-foreground">{manifest.phrases.length}</span>
          </p>
          <p>
            Ref transcript:{" "}
            <span className="text-foreground">{manifest.voiceRefText?.trim() ? "Provided" : "Not provided"}</span>
          </p>
        </div>
      </details>

      {status === "processing" ? (
        <ManifestStatusPoller
          product="soundboard"
          manifestId={id}
          initialStatus="processing"
          initialProgressStep={manifest.progressStep}
        />
      ) : hasClips ? (
        <>
          <SoundboardPlayer
            clips={manifest.clips}
            voicePresetId={manifest.voicePresetId}
          />
          {videoUpsellHref ? <SoundboardVideoUpsell href={videoUpsellHref} /> : null}
        </>
      ) : status === "failed" ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Generation failed</p>
          <p className="text-xs text-muted-foreground">
            {manifest.lastError ?? "Something went wrong. Try generating again."}
          </p>
          <RegenerateSoundboardButton soundboardId={id} />
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-center text-sm text-muted-foreground">
          No clips yet.{" "}
          <RegenerateSoundboardButton soundboardId={id} className="inline" /> to generate clips.
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <DeleteBoardButton id={id} shareUrl={shareUrl} redirectTo="/app/soundboard" />
      </div>
    </div>
  )
}
