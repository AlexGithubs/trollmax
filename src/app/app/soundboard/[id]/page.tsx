import { notFound, redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Info } from "lucide-react"
import type { SoundboardManifest } from "@/lib/manifests/types"
import { SoundboardPlayer } from "@/components/soundboard/SoundboardPlayer"
import { ShareLinkCopy } from "@/components/soundboard/ShareLinkCopy"
import { DeleteBoardButton } from "@/components/soundboard/DeleteBoardButton"

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

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const shareUrl = `${baseUrl}/s/${id}`

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/app/soundboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{manifest.title}</h1>
          <p className="text-xs text-muted-foreground">{manifest.speakerLabel}</p>
        </div>
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

      <ShareLinkCopy shareUrl={shareUrl} />

      {manifest.clips.length > 0 ? (
        <SoundboardPlayer
          clips={manifest.clips}
          voicePresetId={manifest.voicePresetId}
        />
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-center text-sm text-muted-foreground">
          No clips yet.{" "}
          <Link href={`/app/soundboard/${id}/regenerate`} className="text-primary underline">
            Regenerate
          </Link>{" "}
          to generate clips.
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <DeleteBoardButton id={id} shareUrl={shareUrl} redirectTo="/app/soundboard" />
      </div>
    </div>
  )
}
