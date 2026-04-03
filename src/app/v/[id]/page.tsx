import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { getManifestStore } from "@/lib/storage"
import type { VideoManifest } from "@/lib/manifests/types"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import { VideoShareLink } from "@/components/video/VideoShareLink"
import { Video, ArrowRight } from "lucide-react"
import Link from "next/link"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)
  if (!raw) return { title: "Video not found — TROLLMAX" }
  const m = JSON.parse(raw) as VideoManifest
  if (m.status !== "complete" || !m.isPublic) return { title: "Video not found — TROLLMAX" }
  return {
    title: `${m.title} — TROLLMAX`,
    description: `Watch this AI-generated brainrot video on TROLLMAX.`,
    openGraph: {
      title: `${m.title} — TROLLMAX`,
      description: `Watch this AI-generated brainrot video on TROLLMAX.`,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TROLLMAX" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} — TROLLMAX`,
      description: `Watch this AI-generated brainrot video on TROLLMAX.`,
      images: ["/og-image.png"],
    },
  }
}

export default async function VideoSharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const store = getManifestStore()
  const raw = await store.get(`video:${id}`)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const shareUrl = `${baseUrl}/v/${id}`

  if (!raw) {
    return <NotFound id={id} />
  }

  const manifest = JSON.parse(raw) as VideoManifest

  if (manifest.status !== "complete" || !manifest.videoUrl || !manifest.isPublic) {
    return <NotFound id={id} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-sm space-y-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{manifest.title}</h1>
          </div>

          <VideoShareLink shareUrl={shareUrl} />

          <VideoPlayer videoUrl={manifest.videoUrl} />

          <div className="rounded-xl border border-border/40 bg-card/20 px-5 py-4 text-center">
            <p className="text-sm text-muted-foreground">Want to make your own?</p>
            <Link
              href="/app/video/new"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Create a video on TROLLMAX <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Video not found</h1>
          <p className="text-muted-foreground">
            <span className="font-mono text-xs text-primary">/v/{id}</span>
            <br />
            This video doesn&apos;t exist or isn&apos;t available yet.
          </p>
          <Link
            href="/app/video/new"
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
