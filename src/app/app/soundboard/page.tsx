import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { Button } from "@/components/ui/button"
import { GuestMediaEmptyCtas } from "@/components/layout/GuestMediaEmptyCtas"
import { MediaListCard, MediaListPageHeader } from "@/components/layout/MediaListCard"
import { Mic2, Plus, Share2 } from "lucide-react"
import type { SoundboardManifest } from "@/lib/manifests/types"
import {
  MANIFEST_STATUS_BADGE,
  resolveSoundboardStatus,
} from "@/lib/manifests/status-badge"
import { DeleteBoardButton } from "@/components/soundboard/DeleteBoardButton"
import { TrackedShareLink } from "@/components/analytics/TrackedShareLink"

export const metadata = { title: "Soundboards — TROLLMAX" }

function NewSoundboardButton({ atLimit }: { atLimit: boolean }) {
  if (atLimit) {
    return (
      <Button asChild size="sm" variant="secondary" className="w-full sm:w-auto">
        <Link href="/app/soundboard">Limit reached</Link>
      </Button>
    )
  }
  return (
    <Button asChild size="sm" className="w-full sm:w-auto">
      <Link href="/app/soundboard/new">
        <Plus className="mr-1.5 h-4 w-4" />
        New
      </Link>
    </Button>
  )
}

export default async function SoundboardListPage() {
  const user = await currentUser()
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Soundboards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to keep a library here, or jump straight into the creator.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center space-y-4 sm:p-10">
          <Mic2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any saved soundboards yet. Make your first soundboard — you can sign in
            later to save it to this list.
          </p>
          <GuestMediaEmptyCtas
            createHref="/app/soundboard/new"
            createLabel="Make your first soundboard"
          />
        </div>
      </div>
    )
  }

  const store = getManifestStore()
  const [ids, ent] = await Promise.all([
    store.smembers(`user:${user.id}:soundboards`),
    getUserEntitlements(user.id),
  ])

  const boards = (
    await Promise.all(
      ids.map(async (id) => {
        const raw = await store.get(`soundboard:${id}`)
        return raw ? (JSON.parse(raw) as SoundboardManifest) : null
      })
    )
  )
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime()
    ) as SoundboardManifest[]

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const atLimit = ent.soundboardCount >= ent.maxSoundboards

  const limitBanner = atLimit ? (
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      You&apos;ve reached the soundboard limit ({ent.maxSoundboards} soundboards). Delete an
      existing board to create a new one.
    </p>
  ) : null

  if (boards.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <MediaListPageHeader
          title="Your Soundboards"
          subtitle={`0 soundboards · ${ent.soundboardCount}/${ent.maxSoundboards} used`}
          action={<NewSoundboardButton atLimit={atLimit} />}
        />
        {limitBanner}
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center space-y-3 sm:p-10">
          <Mic2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No soundboards yet — create one to see it here.
          </p>
          {!atLimit && (
            <Button asChild size="sm" variant="outline">
              <Link href="/app/soundboard/new">Make your first soundboard</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <MediaListPageHeader
        title="Your Soundboards"
        subtitle={`${boards.length} soundboard${boards.length !== 1 ? "s" : ""} · ${ent.soundboardCount}/${ent.maxSoundboards} used`}
        action={<NewSoundboardButton atLimit={atLimit} />}
      />

      {limitBanner}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {boards.map((board) => {
          const status = resolveSoundboardStatus(board)
          const badge = MANIFEST_STATUS_BADGE[status]
          const dateStr = new Date(board.updatedAt).toLocaleDateString()
          const subtitle = `${board.speakerLabel} · ${board.clips.length} clip${board.clips.length !== 1 ? "s" : ""} · ${dateStr}`

          return (
            <MediaListCard
              key={board.id}
              icon={Mic2}
              title={board.title}
              titleHref={`/app/soundboard/${board.id}`}
              subtitle={subtitle}
              badge={badge}
              actions={
                <>
                  <Button asChild variant="outline" size="sm" className="h-11 flex-1 text-xs">
                    <Link href={`/app/soundboard/${board.id}`}>Edit</Link>
                  </Button>
                  {status === "complete" && (
                    <Button asChild variant="outline" size="sm" className="h-11 flex-1 text-xs">
                      <TrackedShareLink href={`/s/${board.id}`} kind="soundboard" target="_blank">
                        <Share2 className="mr-1 h-3 w-3" />
                        Share
                      </TrackedShareLink>
                    </Button>
                  )}
                </>
              }
              deleteAction={
                <DeleteBoardButton
                  id={board.id}
                  shareUrl={`${baseUrl}/s/${board.id}`}
                  variant="icon"
                />
              }
            />
          )
        })}
      </div>
    </div>
  )
}
