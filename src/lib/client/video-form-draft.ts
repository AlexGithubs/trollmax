import type { WizardStep } from "@/app/app/video/new/VideoWizardStepper"

/** Map onboarding tour step ids to wizard steps so tour spotlights match visible UI. */
export const TOUR_VIDEO_WIZARD_STEP: Partial<Record<string, WizardStep>> = {
  "video-headshot": 1,
  "video-voice-tabs": 1,
  "video-preset-grid": 1,
  "video-script": 2,
  "video-layout": 3,
  "video-background": 3,
  "video-captions": 3,
  "video-generate-btn": 3,
}

export const TOUR_STEP_CHANGED_EVENT = "trollmax:tour-step-changed"

/** Fired after the video wizard has rendered the step matching the tour spotlight. */
export const WIZARD_STEP_READY_EVENT = "trollmax:wizard-step-ready"

export type TourStepChangedDetail = {
  stepId: string
  page: string | null
}

export type WizardStepReadyDetail = {
  stepId: string
}

export function tourStepNeedsVideoWizardSync(stepId: string, page: string | null): boolean {
  return page === "/app/video/new" && stepId in TOUR_VIDEO_WIZARD_STEP
}
