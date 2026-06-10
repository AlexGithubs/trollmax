import { getManifestStore } from "@/lib/storage"
import type { VideoManifest } from "@/lib/manifests/types"

export type UnseenReadyVideo = {
  id: string
  title: string
}

export async function listUnseenReadyVideos(userId: string): Promise<UnseenReadyVideo[]> {
  const store = getManifestStore()
  const ids = await store.smembers(`user:${userId}:videos`)

  const videos = (
    await Promise.all(
      ids.map(async (id) => {
        const raw = await store.get(`video:${id}`)
        return raw ? (JSON.parse(raw) as VideoManifest) : null
      })
    )
  ).filter(Boolean) as VideoManifest[]

  return videos
    .filter((v) => v.ownerId === userId && v.status === "complete" && v.unseenCompletion === true)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((v) => ({ id: v.id, title: v.title }))
}

export async function acknowledgeVideoView(userId: string, videoId: string): Promise<boolean> {
  const store = getManifestStore()
  const raw = await store.get(`video:${videoId}`)
  if (!raw) return false

  const manifest = JSON.parse(raw) as VideoManifest
  if (manifest.ownerId !== userId) return false
  if (!manifest.unseenCompletion) return true

  await store.set(
    `video:${videoId}`,
    JSON.stringify({
      ...manifest,
      unseenCompletion: false,
      updatedAt: new Date().toISOString(),
    })
  )
  return true
}
