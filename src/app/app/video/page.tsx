import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GuestMediaEmptyCtas } from "@/components/layout/GuestMediaEmptyCtas"
import { Video, Plus, Share2 } from "lucide-react"
import type { VideoManifest } from "@/lib/manifests/types"
import { DeleteVideoButton } from "@/components/video/DeleteVideoButton"

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
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center space-y-4">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/app/video/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </Link>
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center space-y-3">
          <Video className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No videos yet — create one to see it here.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/video/new">Make your first video</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {videos.map((video) => {
            const badge = STATUS_BADGE[video.status]
            return (
              <Card key={video.id} className="min-w-0 overflow-hidden border-border/60 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Video className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        href={`/app/video/${video.id}`}
                        className="block w-full min-w-0 truncate font-semibold hover:underline"
                      >
                        {video.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {video.backgroundVideoId}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(video.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                      <Link href={`/app/video/${video.id}`}>View</Link>
                    </Button>
                    {video.status === "complete" && (
                      <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                        <Link href={`/v/${video.id}`} target="_blank">
                          <Share2 className="mr-1 h-3 w-3" />
                          Share
                        </Link>
                      </Button>
                    )}
                  </div>
                  <DeleteVideoButton id={video.id} redirectTo="/app/video" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
