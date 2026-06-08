import type { WizardStep } from "@/app/app/video/new/VideoWizardStepper"

/** Client → server payload for autosaved in-progress videos. */
export type VideoDraftUpsertBody = {
  id?: string
  wizardStep?: WizardStep
  title?: string
  script?: string
  voiceKind?: "preset" | "board" | "upload"
  selectedPresetId?: string | null
  selectedBoardId?: string
  voiceSampleUrl?: string
  voiceUploadRefText?: string
  talkingMode?: "full" | "half"
  headshotImageUrl?: string
  headshotName?: string
  headshotPresetId?: string | null
  backgroundVideoId?: string
  captionsEnabled?: boolean
  consentAcknowledged?: boolean
}

export function hasVideoDraftContent(body: VideoDraftUpsertBody): boolean {
  return Boolean(
    body.title?.trim() ||
      body.script?.trim() ||
      body.headshotImageUrl ||
      body.headshotName?.trim() ||
      body.headshotPresetId ||
      body.voiceSampleUrl ||
      (body.wizardStep && body.wizardStep > 1) ||
      body.consentAcknowledged ||
      body.talkingMode === "half" ||
      (body.backgroundVideoId && body.backgroundVideoId !== "minecraft") ||
      body.captionsEnabled === false
  )
}

export function videoDraftTitle(body: VideoDraftUpsertBody): string {
  const title = body.title?.trim()
  if (title) return title.slice(0, 100)
  const headshot = body.headshotName?.trim()
  if (headshot) return headshot.slice(0, 100)
  const script = body.script?.trim()
  if (script) return (script.length > 60 ? `${script.slice(0, 57)}…` : script).slice(0, 100)
  return "Untitled video"
}
