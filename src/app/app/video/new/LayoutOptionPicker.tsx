import { cn } from "@/lib/utils"

type TalkingMode = "full" | "half"

type Props = {
  value: TalkingMode
  onChange: (mode: TalkingMode) => void
}

function LayoutWireframe({ mode, compact }: { mode: TalkingMode; compact?: boolean }) {
  if (mode === "full") {
    return (
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-lg border border-border/50 bg-secondary/30",
          compact ? "aspect-[9/16] w-16" : "mx-auto aspect-[9/16] w-full max-w-[80px]"
        )}
        aria-hidden
      >
        <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2">
          <div className={cn("rounded-full border-2 border-primary/60 bg-primary/15", compact ? "h-6 w-6" : "h-9 w-9")} />
          <div className="h-1 w-12 rounded-full bg-muted-foreground/25" />
          <div className="h-1 w-9 rounded-full bg-muted-foreground/15" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border border-border/50",
        compact ? "aspect-[9/16] w-16" : "mx-auto aspect-[9/16] w-full max-w-[80px]"
      )}
      aria-hidden
    >
      <div className="flex h-[42%] items-center justify-center border-b border-border/40 bg-secondary/40">
        <div className={cn("rounded-full border-2 border-primary/60 bg-primary/15", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>
      <div className="relative flex h-[58%] items-center justify-center overflow-hidden bg-[#2d5a1b]/50">
        <div className="absolute inset-0 opacity-40">
          <div className="h-full w-full bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0.08)_42%,transparent_42%)] bg-[length:12px_12px]" />
        </div>
        <span className="relative text-[9px] font-medium uppercase tracking-wide text-foreground/70">
          Game clip
        </span>
      </div>
    </div>
  )
}

const OPTIONS: {
  mode: TalkingMode
  title: string
  description: string
  hint: string
}[] = [
  {
    mode: "full",
    title: "Full screen",
    description: "Your character fills the entire video frame.",
    hint: "Best for short clips and close-up reactions.",
  },
  {
    mode: "half",
    title: "Split screen",
    description: "Character on top, moving gameplay clip on the bottom.",
    hint: "Classic brainrot look — keeps longer videos feeling alive.",
  },
]

export function LayoutOptionPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Choose how your talking head is framed in the finished video.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => onChange(opt.mode)}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-colors sm:flex sm:flex-col sm:p-4",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                  : "border-border/40 hover:border-border/80"
              )}
            >
              <div className="flex items-start gap-3 sm:flex-col sm:items-stretch">
                <LayoutWireframe mode={opt.mode} compact />
                <div className="min-w-0 flex-1 sm:mt-3">
                  <p className="text-sm font-semibold">{opt.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">{opt.hint}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
