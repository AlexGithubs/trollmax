import { currentUser } from "@clerk/nextjs/server"
import { getManifestStore } from "@/lib/storage"
import type { SoundboardManifest } from "@/lib/manifests/types"
import { voicePresetsApiPayload } from "@/lib/voice-presets/catalog"
import { NewVideoForm } from "./NewVideoForm"

export const metadata = { title: "New Video — TROLLMAX" }

export default async function NewVideoPage() {
  const user = await currentUser()

  // Unauthenticated users can browse the form; auth is enforced at Generate.
  let boards: SoundboardManifest[] = []
  if (user) {
    const store = getManifestStore()
    const ids = await store.smembers(`user:${user.id}:soundboards`)
    boards = (
      await Promise.all(
        ids.map(async (id) => {
          const raw = await store.get(`soundboard:${id}`)
          return raw ? (JSON.parse(raw) as SoundboardManifest) : null
        })
      )
    ).filter(Boolean) as SoundboardManifest[]
  }

  const { categories, presets } = voicePresetsApiPayload()
  return <NewVideoForm boards={boards} categories={categories} presets={presets} />
}
