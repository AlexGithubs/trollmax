import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { GuestMediaEmptyCtas } from "@/components/layout/GuestMediaEmptyCtas"
import { MediaListCard, MediaListPageHeader } from "@/components/layout/MediaListCard"
import { Video, Plus, Share2 } from "lucide-react"
import type { VideoManifest } from "@/lib/manifests/types"
import { formatVideoListSubtitle } from "@/lib/video/backgrounds"
import { DeleteVideoButton } from "@/components/video/DeleteVideoButton"
import { TrackedShareLink } from "@/components/analytics/TrackedShareLink"
import { VIDEO_NEW_HREF, videoEditHref } from "@/lib/client/video-draft"

export const metadata = { title: "Videos — TROLLMAX" }

const STATUS_BADGE: Record<VideoManifest["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-yellow-500/20 text-yellow-600" },
  complete: { label: "Complete", className: "bg-green-500/20 text-green-600" },
  failed: { label: "Failed", className: "bg-destructive/20 text-destructive" },
}

export default async function VideoListPage() {
  const user = await currentUser()
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to keep a library here, or jump straight into the creator.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center space-y-4 sm:p-10">
          <Video className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any saved videos yet. Make your first video — you can sign in later to
            save it to this list.
          </p>
          <GuestMediaEmptyCtas
            createHref="/app/video/new"
            createLabel="Make your first video"
          />
        </div>
      </div>
    )
  }

  const store = getManifestStore()
  const ids = await store.smembers(`user:${user.id}:videos`)

  const videos = (
    await Promise.all(
      ids.map(async (id) => {
        const raw = await store.get(`video:${id}`)
        return raw ? (JSON.parse(raw) as VideoManifest) : null
      })
    )
  )
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime()
    ) as VideoManifest[]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <MediaListPageHeader
        title="Your Videos"
        subtitle={`${videos.length} video${videos.length !== 1 ? "s" : ""}`}
        action={
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href={VIDEO_NEW_HREF}>
              <Plus className="mr-1.5 h-4 w-4" />
              New
            </Link>
          </Button>
        }
      />

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center space-y-3 sm:p-10">
          <Video className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No videos yet — create one to see it here.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/video/new">Make your first video</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {videos.map((video) => {
            const badge = STATUS_BADGE[video.status]
            const dateStr = new Date(video.updatedAt).toLocaleDateString()
            const subtitle = `${formatVideoListSubtitle(video)} · ${dateStr}`
            const viewHref =
              video.status === "draft"
                ? videoEditHref(video.id)
                : `/app/video/${video.id}`

            return (
              <MediaListCard
                key={video.id}
                icon={Video}
                title={video.title}
                titleHref={viewHref}
                subtitle={subtitle}
                badge={badge}
                actions={
                  <>
                    {video.status === "draft" ? (
                      <Button asChild variant="outline" size="sm" className="h-11 flex-1 text-xs">
                        <Link href={videoEditHref(video.id)}>Continue</Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm" className="h-11 flex-1 text-xs">
                        <Link href={`/app/video/${video.id}`}>View</Link>
                      </Button>
                    )}
                    {video.status === "complete" && (
                      <Button asChild variant="outline" size="sm" className="h-11 flex-1 text-xs">
                        <TrackedShareLink href={`/v/${video.id}`} kind="video" target="_blank">
                          <Share2 className="mr-1 h-3 w-3" />
                          Share
                        </TrackedShareLink>
                      </Button>
                    )}
                  </>
                }
                deleteAction={
                  <DeleteVideoButton id={video.id} redirectTo="/app/video" variant="icon" />
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
