import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type WizardStep = 1 | 2 | 3

const STEPS: { num: WizardStep; short: string; label: string }[] = [
  { num: 1, short: "1", label: "Who's talking?" },
  { num: 2, short: "2", label: "What they say" },
  { num: 3, short: "3", label: "How it looks" },
]

type Props = {
  current: WizardStep
  onStepClick?: (step: WizardStep) => void
}

export function VideoWizardStepper({ current, onStepClick }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <p className="text-xs font-medium text-muted-foreground">
          Step {current} of 3 · {STEPS[current - 1]!.label}
        </p>
        <div className="flex gap-1">
          {STEPS.map((s) => {
            const done = s.num < current
            const clickable = done && onStepClick
            return (
              <button
                key={s.num}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(s.num)}
                aria-label={s.label}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  s.num <= current ? "bg-primary" : "bg-border/60",
                  clickable && "cursor-pointer"
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="hidden sm:flex sm:justify-center">
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const done = s.num < current
            const active = s.num === current
            const clickable = done && onStepClick

            return (
              <li key={s.num} className="flex items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      "mx-3 h-px w-10 shrink-0 sm:w-14",
                      done || active ? "bg-primary/40" : "bg-border/50"
                    )}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(s.num)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                    clickable && "hover:bg-secondary/40",
                    !clickable && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-secondary/20 text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.short}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
