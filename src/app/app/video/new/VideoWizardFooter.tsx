import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  currencyIconAlt,
  currencyIconSrc,
  formatCreditBadgeAmount,
} from "@/lib/billing/currency-display"
import type { WizardStep } from "./VideoWizardStepper"

type Props = {
  step: WizardStep
  canGoNext: boolean
  canGenerate: boolean
  creditCost: number
  nextLabel?: string
  showBack?: boolean
  onBack: () => void
  onNext: () => void
  onGenerate: () => void
}

export function VideoWizardFooter({
  step,
  canGoNext,
  canGenerate,
  creditCost,
  nextLabel = "Next",
  showBack,
  onBack,
  onNext,
  onGenerate,
}: Props) {
  const backVisible = showBack ?? step > 1
  return (
    <div className="fixed inset-x-0 bottom-[var(--app-chrome-bottom)] z-30 min-h-[var(--app-wizard-footer-h)] border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:inset-x-auto lg:bottom-0 lg:left-56 lg:right-0">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 sm:px-6">
        {backVisible ? (
          <Button type="button" variant="outline" size="lg" className="h-12 shrink-0 px-4" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        ) : null}

        {step < 3 ? (
          <Button
            type="button"
            size="lg"
            className="h-12 flex-1 rounded-xl text-base font-semibold"
            disabled={!canGoNext}
            onClick={onNext}
          >
            {nextLabel}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            data-tour="video-generate-btn"
            type="button"
            size="lg"
            className="group h-12 min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:shadow-none sm:px-4 sm:text-base"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            <span className="whitespace-nowrap tracking-tight">Generate Video</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-black/15 px-2 py-0.5 text-sm font-bold backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1">
              <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
              {formatCreditBadgeAmount(creditCost)}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
