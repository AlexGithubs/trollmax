"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { X, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react"
import { TOUR_STEPS, type TourStep } from "./tour-steps"

export const STORAGE_KEY = "trollmax_tour_v1"

// Wait times before measuring element position after a step change
const SCROLL_SETTLE_MS = 380  // when the page actually needs to scroll
/** True if the element's centre is already within the visible viewport */
function isInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  // Use a 60px vertical buffer so elements near the edge don't trigger a full scroll wait
  return r.top >= -60 && r.bottom <= window.innerHeight + 60
}

interface TourState {
  active: boolean
  step: number
}

function loadState(): TourState {
  if (typeof window === "undefined") return { active: false, step: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { active: false, step: 0 }
    return JSON.parse(raw) as TourState
  } catch {
    return { active: false, step: 0 }
  }
}

export function saveState(state: TourState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

function getSpotlightRect(selector: string | null, padding = 8): SpotlightRect | null {
  if (!selector) return null
  // Use querySelectorAll so we find the first *visible* match.
  // Sidebar items have display:none on mobile — their rects are all-zero.
  const els = document.querySelectorAll(selector)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 || r.height > 0) {
      return {
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      }
    }
  }
  return null
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
  const { isSignedIn, isLoaded } = useUser()

  const [state, setState] = useState<TourState>({ active: false, step: 0 })
  const [mounted, setMounted] = useState(false)

  const [spotRect, setSpotRect] = useState<SpotlightRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 })
  const [cardVisible, setCardVisible] = useState(false)

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

  // ── Auth-aware initialisation ───────────────────────────────────────────────
  // Runs once auth state is determined. Only auto-starts the tour for signed-in
  // users landing on /app for the first time. Every other path (guests on form
  // pages, direct links, post-signup returns) stays inactive — the opt-in
  // TourOfferBanner handles guests on form pages separately.
  useEffect(() => {
    if (!mounted || !isLoaded) return

    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw !== null) {
      // Returning visitor — restore saved state (may be mid-tour or dismissed)
      try {
        setState(JSON.parse(raw) as TourState)
      } catch {
        // corrupted — leave inactive
      }
      return
    }

    // Truly first visit (no key in localStorage)
    if (pathname === "/app" && isSignedIn === true) {
      // Signed-in user visiting the dashboard for the first time → full tour
      const ns: TourState = { active: true, step: 0 }
      setState(ns)
      saveState(ns)
    }
    // All other cases (guest, direct link to form, post-signup return, etc.)
    // stay inactive. TourOfferBanner handles guests on form pages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoaded])

  // ── Listen for banner-triggered tour starts ─────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TourState>).detail
      setState(detail)
    }
    window.addEventListener("trollmax:start-tour", handler)
    return () => window.removeEventListener("trollmax:start-tour", handler)
  }, [])

  const currentStep = TOUR_STEPS[state.step] ?? null
  const isOnCorrectPage = currentStep?.page === null || currentStep?.page === pathname

  // ── Measure + reveal card ───────────────────────────────────────────────────
  const measureAndShow = useCallback(() => {
    if (!currentStep || !isOnCorrectPage) return
    const spot = getSpotlightRect(
      currentStep.targetSelector,
      currentStep.spotlightPadding ?? 8
    )
    setSpotRect(spot)
    setTooltipPos(computeTooltipPosition(spot, currentStep.placement))
    setCardVisible(true)
  }, [currentStep, isOnCorrectPage])

  // ── Step change ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !state.active || !currentStep) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Wrong page: quick fade to centered transition card.
    if (!isOnCorrectPage) {
      setCardVisible(false)
      timerRef.current = setTimeout(() => {
        setSpotRect(null)
        setTooltipPos(computeTooltipPosition(null, "center"))
        setCardVisible(true)
      }, 160)
      return
    }

    // Correct page: NEVER fade the card — it stays fully visible.
    // For elements already on screen the spotlight slides instantly.
    // For elements off-screen we scroll smoothly then update positions;
    // the card remains visible at the old position during the scroll and
    // glides to the new one once we measure.

    // Use querySelectorAll so we skip hidden sidebar elements on mobile
    let targetEl: Element | null = null
    if (currentStep.targetSelector) {
      for (const el of document.querySelectorAll(currentStep.targetSelector)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 || r.height > 0) { targetEl = el; break }
      }
    }

    const isMobile = window.innerWidth < DESKTOP_BREAKPOINT

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      if (isMobile) {
        // On mobile, scroll so the element TOP sits just below the sticky header.
        // This keeps the element's beginning visible while the card sits at the bottom.
        const desiredTop = MOBILE_HEADER_H + 12
        const delta = rect.top - desiredTop
        if (Math.abs(delta) > 40) {
          window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "smooth" })
          timerRef.current = setTimeout(() => {
            rafRef.current = requestAnimationFrame(measureAndShow)
          }, SCROLL_SETTLE_MS)
        } else {
          rafRef.current = requestAnimationFrame(measureAndShow)
        }
      } else if (!isInViewport(targetEl)) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
        timerRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(measureAndShow)
        }, SCROLL_SETTLE_MS)
      } else {
        rafRef.current = requestAnimationFrame(measureAndShow)
      }
    } else {
      rafRef.current = requestAnimationFrame(measureAndShow)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, mounted, state.active, isOnCorrectPage])

  // ── Reposition on resize / scroll ──────────────────────────────────────────
  useEffect(() => {
    if (!state.active || !cardVisible) return
    const handle = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measureAndShow)
    }
    window.addEventListener("resize", handle, { passive: true })
    window.addEventListener("scroll", handle, { passive: true, capture: true })
    return () => {
      window.removeEventListener("resize", handle)
      window.removeEventListener("scroll", handle, { capture: true } as EventListenerOptions)
    }
  }, [state.active, cardVisible, measureAndShow])

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
      const ns: TourState = { active: true, step: pendingStepRef.current }
      setState(ns)
      saveState(ns)
      pendingStepRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── Actions ─────────────────────────────────────────────────────────────────
  function skip() {
    pendingStepRef.current = null
    const done: TourState = { active: false, step: 0 }
    setState(done)
    saveState(done)
  }

  function next() {
    const nextStep = state.step + 1
    if (nextStep >= TOUR_STEPS.length) { skip(); return }
    const ns: TourState = { active: true, step: nextStep }
    setState(ns)
    saveState(ns)
  }

  function prev() {
    if (state.step === 0) return
    pendingStepRef.current = null
    const prevIdx = state.step - 1
    const prevStep = TOUR_STEPS[prevIdx]
    // If the previous step lives on a different page, navigate there first
    // and let the pending-step effect commit the state change on arrival.
    if (prevStep && prevStep.page !== null && prevStep.page !== pathname) {
      pendingStepRef.current = prevIdx
      router.push(prevStep.page)
      return
    }
    const ns: TourState = { active: true, step: prevIdx }
    setState(ns)
    saveState(ns)
  }

  // Navigate to a destination page and advance to the next step once the
  // page loads. State stays on the current step during the transition so
  // no wrong-page flash is shown.
  // If we're already on the correct page for the next step, advance immediately
  // — router.push to the same URL won't change pathname so the effect won't fire.
  function navigateAndAdvance(href: string) {
    const nextIdx = state.step + 1
    if (nextIdx >= TOUR_STEPS.length) { skip(); return }
    const nextStepDef = TOUR_STEPS[nextIdx]
    const alreadyOnPage = nextStepDef.page === null || nextStepDef.page === pathname
    if (alreadyOnPage) {
      const ns: TourState = { active: true, step: nextIdx }
      setState(ns)
      saveState(ns)
      return
    }
    pendingStepRef.current = nextIdx
    router.push(href)
  }

  // Used by the wrong-page transition card's "Take me there" button: we're
  // already on the correct step — we just need to get to the right page.
  function justNavigate(href: string) {
    router.push(href)
  }

  if (!mounted || !state.active || !currentStep) return null

  return createPortal(
    <TourOverlay
      step={currentStep}
      stepIndex={state.step}
      totalSteps={TOUR_STEPS.length}
      isOnCorrectPage={isOnCorrectPage}
      spotRect={spotRect}
      tooltipPos={tooltipPos}
      cardVisible={cardVisible}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      onNavigate={navigateAndAdvance}
      onJustNavigate={justNavigate}
    />,
    document.body
  )
}

// ─── Restart button ───────────────────────────────────────────────────────────

export function TourRestartButton() {
  const router = useRouter()
  const { isSignedIn } = useUser()

  function handleRestart() {
    const ns: TourState = { active: true, step: 0 }
    saveState(ns)
    if (isSignedIn) {
      // Signed-in users go to the dashboard where the full tour starts
      router.push("/app")
      router.refresh()
    } else {
      // Guests stay on the current page — dispatch the event so OnboardingTour
      // picks up the new state without a navigation that requires auth
      window.dispatchEvent(new CustomEvent("trollmax:start-tour", { detail: ns }))
    }
  }

  return (
    <button
      onClick={handleRestart}
      title="Restart onboarding tour"
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-3 py-1.5 hover:bg-secondary w-full"
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      <span>Tour guide</span>
    </button>
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

interface OverlayProps {
  step: TourStep
  stepIndex: number
  totalSteps: number
  isOnCorrectPage: boolean
  spotRect: SpotlightRect | null
  tooltipPos: TooltipPosition
  cardVisible: boolean
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
  stepIndex,
  totalSteps,
  isOnCorrectPage,
  spotRect,
  tooltipPos,
  cardVisible,
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
  const hasSpot = r !== null && isOnCorrectPage && step.targetSelector !== null
  // Must match the width formula in computeTooltipPosition
  const margin = 16
  const tooltipW = isDesktop ? Math.min(TOOLTIP_W, vw - margin * 2) : vw - margin * 2
  const isLast = stepIndex === totalSteps - 1

  const fadeStyle = {
    opacity: cardVisible ? 1 : 0,
    // top/left transitions let the card slide smoothly for nearby steps.
    // They also fire while opacity is 0 (for scroll transitions), so the card
    // arrives at the new position before it fades in — never a visible jump.
    transition: "opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), top 0.28s ease, left 0.28s ease",
    pointerEvents: (cardVisible ? "auto" : "none") as React.CSSProperties["pointerEvents"],
  }

  const spotTransition = "x 0.28s ease, y 0.28s ease, width 0.28s ease, height 0.28s ease"

  // ── Wrong-page transition card ──────────────────────────────────────────────
  if (!isOnCorrectPage && step.page !== null) {
    const destName = PAGE_NAMES[step.page] ?? "the next section"
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        style={fadeStyle}
      >
        <div
          className="relative w-full rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-4 mx-4"
          style={{ maxWidth: 400 }}
        >
          <button
            onClick={onSkip}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="space-y-1 pr-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <h2 className="text-lg font-bold leading-snug">
              Next up: {destName}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The next part of the tour is on {destName}. Head there to continue.
            </p>
          </div>
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
        </div>
      </div>
    )
  }

  // ── Normal spotlight + card ─────────────────────────────────────────────────
  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 z-[9998]" aria-hidden style={{ ...fadeStyle, pointerEvents: "none" }}>
        {hasSpot ? (
          <svg width={vw} height={vh} className="absolute inset-0" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="tour-spotlight-mask">
                <rect width={vw} height={vh} fill="white" />
                <rect
                  x={r!.left} y={r!.top} width={r!.width} height={r!.height} rx={8} fill="black"
                  style={{ transition: spotTransition }}
                />
              </mask>
            </defs>
            <rect width={vw} height={vh} fill="rgba(0,0,0,0.65)" mask="url(#tour-spotlight-mask)" />
            <rect
              x={r!.left} y={r!.top} width={r!.width} height={r!.height}
              rx={8} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} opacity={0.8}
              style={{ transition: spotTransition }}
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
        )}
      </div>

      {/* Tooltip card */}
      <div
        className="fixed z-[9999] rounded-2xl border border-border/60 bg-card shadow-2xl"
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: tooltipW, ...fadeStyle }}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Step {stepIndex + 1} of {totalSteps}
              </p>
              <h2 className="text-base font-bold leading-snug">{step.title}</h2>
            </div>
            <button
              onClick={onSkip}
              className="shrink-0 mt-0.5 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Skip tour (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>

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
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onPrev}
              disabled={stepIndex === 0}
              className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <span className="text-[11px] tabular-nums text-muted-foreground select-none">
              {stepIndex + 1} / {totalSteps}
            </span>
            <button
              onClick={step.navigateTo ? () => onNavigate(step.navigateTo!) : onNext}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
