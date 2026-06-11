import { Suspense } from "react"
import { voicePresetsApiPayload } from "@/lib/voice-presets/catalog"
import { NewVideoForm } from "./NewVideoForm"

export const metadata = { title: "New Video — TROLLMAX" }

export default async function NewVideoPage() {
  const { categories, presets } = voicePresetsApiPayload()
  return (
    <Suspense fallback={null}>
      <NewVideoForm categories={categories} presets={presets} />
    </Suspense>
  )
}
