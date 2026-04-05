import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Mic2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest } from "@/lib/manifests/types"
import { SoundboardPlayer } from "@/components/soundboard/SoundboardPlayer"
import { ShareMenu } from "@/components/share/ShareMenu"
import { getSiteBaseUrl } from "@/lib/site-url"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`soundboard:${id}`)
  if (!raw) return { title: "Soundboard not found — TROLLMAX" }
  const m = JSON.parse(raw) as SoundboardManifest
  if (!m.isPublic) return { title: "Soundboard not found — TROLLMAX" }

  const base = getSiteBaseUrl() ?? ""
  const canonical = base ? `${base}/s/${id}` : `/s/${id}`
  const desc = `Check out what I made on Trollmax.xyz! ${m.speakerLabel}'s voice · ${m.clips.length} clips on TROLLMAX.`
  const ogImage = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "TROLLMAX" }]

  return {
    title: `${m.title} · Trollmax`,
    description: desc,
    openGraph: {
      title: `${m.title} · Trollmax`,
      description: desc,
      url: canonical,
      type: "website",
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} · Trollmax`,
      description: desc,
      images: ogImage.map((i) => i.url),
    },
  }
}

export default async function SoundboardSharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`soundboard:${id}`)

  const baseUrl = getSiteBaseUrl() ?? "http://localhost:3000"
  const shareUrl = `${baseUrl}/s/${id}`

  if (!raw) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Mic2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Soundboard not found</h1>
            <p className="text-sm text-muted-foreground">
              This soundboard doesn&apos;t exist or hasn&apos;t been made public.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Create your own <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const manifest = JSON.parse(raw) as SoundboardManifest

  if (!manifest.isPublic) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Mic2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Soundboard not found</h1>
            <p className="text-sm text-muted-foreground">
              This soundboard doesn&apos;t exist or hasn&apos;t been made public.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Create your own <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">{manifest.title}</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{manifest.speakerLabel}</span>
                &apos;s voice · {manifest.clips.length} clip{manifest.clips.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ShareMenu shareUrl={shareUrl} kind="soundboard" className="shrink-0" />
          </div>

          {/* Player */}
          {manifest.clips.length > 0 ? (
            <SoundboardPlayer clips={manifest.clips} />
          ) : (
            <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              No clips available yet.
            </div>
          )}

          {/* CTA */}
          <div className="rounded-xl border border-border/40 bg-card/20 px-5 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Want to make your own?
            </p>
            <Link
              href="/app"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Create a soundboard on TROLLMAX <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
