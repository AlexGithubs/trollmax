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
  onBack,
  onNext,
  onGenerate,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:inset-x-auto lg:bottom-0 lg:left-56 lg:right-0">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-3">
        {step > 1 ? (
          <Button type="button" variant="outline" size="lg" className="h-12 shrink-0 px-4" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        ) : (
          <div className="w-[88px] shrink-0" />
        )}

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
            className="group h-12 flex-1 justify-between rounded-xl px-4 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:shadow-none"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            <span className="tracking-tight">Generate Video</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-sm font-bold backdrop-blur-sm">
              <img src={currencyIconSrc()} alt={currencyIconAlt()} className="h-6 w-6 object-contain" />
              {formatCreditBadgeAmount(creditCost)}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
