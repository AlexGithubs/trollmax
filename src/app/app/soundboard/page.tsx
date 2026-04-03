import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getManifestStore } from "@/lib/storage"
import { getUserEntitlements } from "@/lib/billing/entitlements"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GuestMediaEmptyCtas } from "@/components/layout/GuestMediaEmptyCtas"
import { Mic2, Plus, Share2 } from "lucide-react"
import type { SoundboardManifest } from "@/lib/manifests/types"
import { DeleteBoardButton } from "@/components/soundboard/DeleteBoardButton"

export const metadata = { title: "Soundboards — TROLLMAX" }

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
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center space-y-4">
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

  if (boards.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Soundboards</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              0 soundboards ·{" "}
              <span className="font-medium text-foreground">
                {ent.soundboardCount}/{ent.maxSoundboards} used
              </span>
            </p>
          </div>
          {atLimit ? (
            <Button asChild size="sm" variant="secondary">
              <Link href="/app/soundboard">Limit reached</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/app/soundboard/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New
              </Link>
            </Button>
          )}
        </div>
        {atLimit && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            You&apos;ve reached the soundboard limit ({ent.maxSoundboards} soundboards). Delete an
            existing board to create a new one.
          </p>
        )}
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center space-y-3">
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Soundboards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {boards.length} soundboard{boards.length !== 1 ? "s" : ""}
            {" "}·{" "}
            <span className="text-foreground font-medium">
              {ent.soundboardCount}/{ent.maxSoundboards} used
            </span>
          </p>
        </div>
        {atLimit ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/soundboard">Limit reached</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/app/soundboard/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New
            </Link>
          </Button>
        )}
      </div>

      {atLimit && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          You&apos;ve reached the soundboard limit ({ent.maxSoundboards} soundboards). Delete an
          existing board to create a new one.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {boards.map((board) => (
          <Card key={board.id} className="min-w-0 overflow-hidden border-border/60 bg-card/50">
            <CardHeader className="pb-2">
              <div className="flex min-w-0 items-start gap-2">
                <Mic2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <Link
                    href={`/app/soundboard/${board.id}`}
                    className="block w-full min-w-0 truncate font-semibold hover:underline"
                  >
                    {board.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{board.speakerLabel}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {board.clips.length} clip{board.clips.length !== 1 ? "s" : ""} ·{" "}
                {new Date(board.updatedAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                  <Link href={`/app/soundboard/${board.id}`}>Edit</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                  <Link href={`/s/${board.id}`} target="_blank">
                    <Share2 className="mr-1 h-3 w-3" />
                    Share
                  </Link>
                </Button>
              </div>
              <DeleteBoardButton id={board.id} shareUrl={`${baseUrl}/s/${board.id}`} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
