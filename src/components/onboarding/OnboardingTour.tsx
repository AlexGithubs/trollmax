"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { TOUR_STEPS, tourDisplayStep, type TourStep, type TourRuntimeState } from "./tour-steps"
import { consumeTourResumeContext } from "@/lib/client/tour-resume"
import { launchTour, saveTourState, TOUR_START_EVENT, TOUR_STORAGE_KEY } from "@/lib/client/tour-launch"
import {
  TOUR_STEP_CHANGED_EVENT,
  WIZARD_STEP_READY_EVENT,
  tourStepNeedsVideoWizardSync,
  type WizardStepReadyDetail,
} from "@/lib/client/video-form-draft"

export { TourGuideButton, TourRestartButton } from "./TourGuideButton"
export { saveTourState as saveState, TOUR_STORAGE_KEY as STORAGE_KEY } from "@/lib/client/tour-launch"

// Wait times before measuring element position after a step change
const SCROLL_SETTLE_MS = 380 // when the page actually needs to scroll
const SLIDE_TRANSITION = "top 0.32s cubic-bezier(0.4, 0, 0.2, 1), left 0.32s cubic-bezier(0.4, 0, 0.2, 1)"
const SPOT_TRANSITION =
  "x 0.32s cubic-bezier(0.4, 0, 0.2, 1), y 0.32s cubic-bezier(0.4, 0, 0.2, 1), width 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.32s cubic-bezier(0.4, 0, 0.2, 1)"
/** True if the element's centre is already within the visible viewport */
function isInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  // Use a 60px vertical buffer so elements near the edge don't trigger a full scroll wait
  return r.top >= -60 && r.bottom <= window.innerHeight + 60
}

interface TourState extends TourRuntimeState {}

function loadState(): TourState {
  if (typeof window === "undefined") return { active: false, step: 0 }
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY)
    if (raw === null) return { active: false, step: 0 }
    const parsed = JSON.parse(raw) as TourState
    if (typeof parsed.active !== "boolean" || typeof parsed.step !== "number") {
      return { active: false, step: 0 }
    }
    return parsed
  } catch {
    return { active: false, step: 0 }
  }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

function findVisibleTarget(selector: string | null): Element | null {
  if (!selector) return null
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 1 && r.height > 1) return el
  }
  return null
}

function getSpotlightRect(selector: string | null, padding = 8): SpotlightRect | null {
  const el = findVisibleTarget(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top - padding,
    left: r.left - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  }
}

function waitForWizardStepReady(stepId: string, timeoutMs = 900): Promise<void> {
  return new Promise((resolve) => {
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent<WizardStepReadyDetail>).detail
      if (detail.stepId === stepId) done()
    }
    const timer = setTimeout(done, timeoutMs)
    function done() {
      clearTimeout(timer)
      window.removeEventListener(WIZARD_STEP_READY_EVENT, onReady)
      resolve()
    }
    window.addEventListener(WIZARD_STEP_READY_EVENT, onReady)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface TooltipPosition {
  top: number
  left: number
}

const TOOLTIP_W = 320
const TOOLTIP_H = 220
// lg breakpoint — below this the sidebar is hidden and a bottom nav bar is shown
const DESKTOP_BREAKPOINT = 1024
const BOTTOM_NAV_H = 64
const MOBILE_HEADER_H = 64

function computeTooltipPosition(
  spot: SpotlightRect | null,
  placement: TourStep["placement"]
): TooltipPosition {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 16
  const isDesktop = vw >= DESKTOP_BREAKPOINT
  // Must match the width formula used in TourOverlay to avoid left/width mismatch
  const w = isDesktop ? Math.min(TOOLTIP_W, vw - margin * 2) : vw - margin * 2

  if (!spot || placement === "center") {
    return {
      top: Math.round(vh / 2 - TOOLTIP_H / 2),
      left: Math.round(vw / 2 - w / 2),
    }
  }

  // ── Mobile / tablet: anchor the card to bottom of screen by default ─────────
  // The scroll logic above positions the element top just below the header,
  // so a bottom-anchored card can never cover it.
  // Exception: element is near the bottom (e.g. bottom-nav items) → card at top.
  if (!isDesktop) {
    const cardAtBottomTop = vh - TOOLTIP_H - margin - BOTTOM_NAV_H
    // If the element's TOP is inside the bottom card zone, flip to top
    const elementNearBottom = spot.top > cardAtBottomTop - 60
    const cardTop = elementNearBottom ? MOBILE_HEADER_H + margin : cardAtBottomTop
    return {
      top: Math.round(Math.max(MOBILE_HEADER_H + 4, cardTop)),
      left: margin,
    }
  }

  // ── Desktop: position adjacent to the spotlight ───────────────────────────
  let top = 0
  let left = 0

  switch (placement) {
    case "bottom":
      top = spot.top + spot.height + 14
      left = spot.left + spot.width / 2 - w / 2
      break
    case "top":
      top = spot.top - TOOLTIP_H - 14
      left = spot.left + spot.width / 2 - w / 2
      break
    case "right":
      top = spot.top + spot.height / 2 - TOOLTIP_H / 2
      left = spot.left + spot.width + 14
      break
    case "left":
      top = spot.top + spot.height / 2 - TOOLTIP_H / 2
      left = spot.left - w - 14
      break
  }

  return {
    top: Math.round(Math.max(margin, Math.min(top, vh - TOOLTIP_H - margin))),
    left: Math.round(Math.max(margin, Math.min(left, vw - w - margin))),
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoaded } = useUser()

  const [state, setState] = useState<TourState>({ active: false, step: 0 })
  const [mounted, setMounted] = useState(false)

  const [spotRect, setSpotRect] = useState<SpotlightRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  // When navigating to a new page, we store the target step index here and
  // only commit it once pathname actually changes. This prevents the brief
  // wrong-page flash that happens if we advance state before the page loads.
  const pendingStepRef = useRef<number | null>(null)

  // ── Mount ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
  }, [])

  // ── First visit: offer tour from any /app route (signed in or not) ───────────
  useEffect(() => {
    if (!mounted || !isLoaded) return

    const raw = localStorage.getItem(TOUR_STORAGE_KEY)

    if (raw !== null) {
      try {
        setState(JSON.parse(raw) as TourState)
      } catch {
        /* corrupted */
      }
      return
    }

    if (pathname === "/app" || pathname === "/app/") {
      const ns = launchTour("full", pathname)
      setState(ns)
    }
  }, [mounted, isLoaded, pathname])

  // ── Listen for banner-triggered tour starts ─────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TourState>).detail
      setState(detail)
    }
    window.addEventListener(TOUR_START_EVENT, handler)
    return () => window.removeEventListener(TOUR_START_EVENT, handler)
  }, [])

  const currentStep = TOUR_STEPS[state.step] ?? null
  const isOnCorrectPage = currentStep?.page === null || currentStep?.page === pathname

  const isTransitionStep = Boolean(currentStep?.page && !isOnCorrectPage)

  const layoutForStep = useCallback(() => {
    if (!currentStep) return

    if (isTransitionStep) {
      setSpotRect(null)
      setTooltipPos(computeTooltipPosition(null, "center"))
      return
    }

    const spot = getSpotlightRect(
      currentStep.targetSelector,
      currentStep.spotlightPadding ?? 8
    )
    setSpotRect(spot)
    setTooltipPos(computeTooltipPosition(spot, currentStep.placement))
  }, [currentStep, isTransitionStep])

  // ── Step change ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !state.active || !currentStep) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    let cancelled = false

    if (isTransitionStep) {
      layoutForStep()
      return () => {
        cancelled = true
      }
    }

    async function revealTarget() {
      if (tourStepNeedsVideoWizardSync(currentStep!.id, currentStep!.page)) {
        window.dispatchEvent(
          new CustomEvent(TOUR_STEP_CHANGED_EVENT, {
            detail: { stepId: currentStep!.id, page: currentStep!.page },
          })
        )
        await waitForWizardStepReady(currentStep!.id)
      }

      if (cancelled) return

      let targetEl = findVisibleTarget(currentStep!.targetSelector)
      for (let attempt = 0; attempt < 10 && !targetEl && currentStep!.targetSelector; attempt++) {
        await delay(50)
        if (cancelled) return
        targetEl = findVisibleTarget(currentStep!.targetSelector)
      }

      if (cancelled) return

      const isMobile = window.innerWidth < DESKTOP_BREAKPOINT

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect()
        if (isMobile) {
          const desiredTop = MOBILE_HEADER_H + 12
          const delta = rect.top - desiredTop
          if (Math.abs(delta) > 40) {
            window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "smooth" })
            await delay(SCROLL_SETTLE_MS)
            if (cancelled) return
          }
        } else if (!isInViewport(targetEl)) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
          await delay(SCROLL_SETTLE_MS)
          if (cancelled) return
        }
      }

      if (cancelled) return
      rafRef.current = requestAnimationFrame(layoutForStep)
    }

    void revealTarget()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, mounted, state.active, isOnCorrectPage, isTransitionStep])

  // ── Reposition on resize / scroll ──────────────────────────────────────────
  useEffect(() => {
    if (!state.active) return
    const handle = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(layoutForStep)
    }
    window.addEventListener("resize", handle, { passive: true })
    window.addEventListener("scroll", handle, { passive: true, capture: true })
    return () => {
      window.removeEventListener("resize", handle)
      window.removeEventListener("scroll", handle, { capture: true } as EventListenerOptions)
    }
  }, [state.active, layoutForStep])

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip()
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Commit pending step when pathname reaches the expected destination ───────
  useEffect(() => {
    if (pendingStepRef.current === null) return
    const target = TOUR_STEPS[pendingStepRef.current]
    if (!target) { pendingStepRef.current = null; return }
    // Advance once the right page has loaded (page-agnostic steps advance immediately)
    if (target.page === null || target.page === pathname) {
      const ns: TourState = {
        active: true,
        step: pendingStepRef.current,
        segmentStart: state.segmentStart,
        segmentEnd: state.segmentEnd,
      }
      setState(ns)
      saveTourState(ns)
      pendingStepRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── Actions ─────────────────────────────────────────────────────────────────
  function skip() {
    pendingStepRef.current = null
    const done: TourState = { active: false, step: 0 }
    setState(done)
    saveTourState(done)

    const resume = consumeTourResumeContext()
    if (resume?.returnPath) {
      const current =
        pathname + (typeof window !== "undefined" ? window.location.search : "")
      if (resume.returnPath !== current) {
        router.push(resume.returnPath, { scroll: false })
      }
    }
  }

  function advanceState(nextStep: number) {
    const ns: TourState = {
      active: true,
      step: nextStep,
      segmentStart: state.segmentStart,
      segmentEnd: state.segmentEnd,
    }
    setState(ns)
    saveTourState(ns)
  }

  function next() {
    const { isLast } = tourDisplayStep(state)
    if (isLast) {
      skip()
      return
    }
    const nextStep = state.step + 1
    if (nextStep >= TOUR_STEPS.length) {
      skip()
      return
    }
    advanceState(nextStep)
  }

  function prev() {
    const { isFirst } = tourDisplayStep(state)
    if (isFirst) return
    pendingStepRef.current = null
    const prevIdx = state.step - 1
    const prevStep = TOUR_STEPS[prevIdx]
    if (prevStep && prevStep.page !== null && prevStep.page !== pathname) {
      pendingStepRef.current = prevIdx
      router.push(prevStep.page, { scroll: false })
      return
    }
    advanceState(prevIdx)
  }

  function navigateAndAdvance(href: string) {
    const { isLast } = tourDisplayStep(state)
    const nextIdx = state.step + 1
    if (isLast || nextIdx > (state.segmentEnd ?? TOUR_STEPS.length - 1) || nextIdx >= TOUR_STEPS.length) {
      skip()
      return
    }
    const nextStepDef = TOUR_STEPS[nextIdx]
    const alreadyOnPage = nextStepDef.page === null || nextStepDef.page === pathname
    if (alreadyOnPage) {
      advanceState(nextIdx)
      return
    }
    pendingStepRef.current = nextIdx
    router.push(href, { scroll: false })
  }

  // Used by the wrong-page transition card's "Take me there" button: we're
  // already on the correct step — we just need to get to the right page.
  function justNavigate(href: string) {
    router.push(href, { scroll: false })
  }

  if (!mounted || !state.active || !currentStep) return null

  const display = tourDisplayStep(state)

  return createPortal(
    <TourOverlay
      step={currentStep}
      displayStep={display.current}
      displayTotal={display.total}
      isFirstStep={display.isFirst}
      isLastStep={display.isLast}
      isTransitionStep={isTransitionStep}
      spotRect={spotRect}
      tooltipPos={tooltipPos}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      onNavigate={navigateAndAdvance}
      onJustNavigate={justNavigate}
    />,
    document.body
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

interface OverlayProps {
  step: TourStep
  displayStep: number
  displayTotal: number
  isFirstStep: boolean
  isLastStep: boolean
  isTransitionStep: boolean
  spotRect: SpotlightRect | null
  tooltipPos: TooltipPosition
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  /** Navigate + advance: used by a step's own navigateTo button */
  onNavigate: (href: string) => void
  /** Navigate only: used by the wrong-page transition card's "Take me there" */
  onJustNavigate: (href: string) => void
}

// Human-readable names for each page used in transition cards
const PAGE_NAMES: Record<string, string> = {
  "/app": "the Dashboard",
  "/app/video/new": "the Video Creator",
  "/app/soundboard/new": "the Soundboard Creator",
}

function TourOverlay({
  step,
  displayStep,
  displayTotal,
  isFirstStep,
  isLastStep,
  isTransitionStep,
  spotRect,
  tooltipPos,
  onNext,
  onPrev,
  onSkip,
  onNavigate,
  onJustNavigate,
}: OverlayProps) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const isDesktop = vw >= DESKTOP_BREAKPOINT
  const r = spotRect
  const hasSpot = !isTransitionStep && r !== null && step.targetSelector !== null
  const margin = 16
  const tooltipW = isDesktop ? Math.min(TOOLTIP_W, vw - margin * 2) : vw - margin * 2
  const destName = step.page ? PAGE_NAMES[step.page] ?? "the next section" : ""

  const cardStyle: React.CSSProperties = {
    top: tooltipPos.top,
    left: tooltipPos.left,
    width: isTransitionStep ? Math.min(400, tooltipW) : tooltipW,
    transition: SLIDE_TRANSITION,
  }

  return (
    <>
      <div className="fixed inset-0 z-[9998]" aria-hidden style={{ pointerEvents: "none" }}>
        {hasSpot ? (
          <svg width={vw} height={vh} className="absolute inset-0" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="tour-spotlight-mask">
                <rect width={vw} height={vh} fill="white" />
                <rect
                  x={r!.left}
                  y={r!.top}
                  width={r!.width}
                  height={r!.height}
                  rx={8}
                  fill="black"
                  style={{ transition: SPOT_TRANSITION }}
                />
              </mask>
            </defs>
            <rect width={vw} height={vh} fill="rgba(0,0,0,0.65)" mask="url(#tour-spotlight-mask)" />
            <rect
              x={r!.left}
              y={r!.top}
              width={r!.width}
              height={r!.height}
              rx={8}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              opacity={0.8}
              style={{ transition: SPOT_TRANSITION }}
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
        )}
      </div>

      <div
        className="fixed z-[9999] rounded-2xl border border-border/60 bg-card shadow-2xl"
        style={cardStyle}
      >
        <div className={isTransitionStep ? "space-y-4 p-6" : "space-y-4 p-5"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Step {displayStep} of {displayTotal}
              </p>
              <h2 className="text-base font-bold leading-snug">
                {isTransitionStep ? `Next up: ${destName}` : step.title}
              </h2>
            </div>
            <button
              onClick={onSkip}
              className="shrink-0 mt-0.5 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Skip tour (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {isTransitionStep
              ? `The next part of the tour is on ${destName}. Head there to continue.`
              : step.content}
          </p>

          {isTransitionStep ? (
            <div className="flex gap-2">
              {step.page && (
                <button
                  onClick={() => onJustNavigate(step.page!)}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Take me there
                </button>
              )}
              <button
                onClick={onSkip}
                className="rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
              >
                Skip tour
              </button>
            </div>
          ) : (
            <>
              {step.navigateTo && (
                <button
                  onClick={() => onNavigate(step.navigateTo!)}
                  className="w-full rounded-xl bg-primary/10 border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors text-left"
                >
                  {step.navigateLabel ?? `Continue to ${step.navigateTo}`}
                </button>
              )}

              <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${(displayStep / displayTotal) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={onPrev}
                  disabled={isFirstStep}
                  className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <span className="text-[11px] tabular-nums text-muted-foreground select-none">
                  {displayStep} / {displayTotal}
                </span>
                <button
                  onClick={step.navigateTo ? () => onNavigate(step.navigateTo!) : onNext}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {isLastStep ? "Done" : "Next"}
                  {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
