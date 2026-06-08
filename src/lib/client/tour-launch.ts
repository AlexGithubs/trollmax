import { saveTourResumeContext } from "@/lib/client/tour-resume"
import {
  createContextualTourState,
  createFullTourState,
  type TourMode,
  type TourRuntimeState,
} from "@/components/onboarding/tour-steps"

export const TOUR_STORAGE_KEY = "trollmax_tour_v1"
export const TOUR_START_EVENT = "trollmax:start-tour"

export function saveTourState(state: TourRuntimeState): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function launchTour(
  mode: TourMode,
  returnPath: string,
  options?: { saveResume?: boolean }
): TourRuntimeState {
  if (options?.saveResume !== false && returnPath.startsWith("/app")) {
    saveTourResumeContext(returnPath)
  }

  const pathOnly = returnPath.split("?")[0] ?? returnPath

  const state =
    mode === "full"
      ? createFullTourState()
      : createContextualTourState(pathOnly)

  saveTourState(state)
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: state }))
  return state
}
