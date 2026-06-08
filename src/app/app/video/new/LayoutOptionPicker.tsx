import { cn } from "@/lib/utils"

type TalkingMode = "full" | "half"

type Props = {
  value: TalkingMode
  onChange: (mode: TalkingMode) => void
}

function LayoutWireframe({ mode }: { mode: TalkingMode }) {
  if (mode === "full") {
    return (
      <div
        className="mx-auto aspect-[9/16] w-full max-w-[80px] overflow-hidden rounded-lg border border-border/50 bg-secondary/30"
        aria-hidden
      >
        <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2">
          <div className="h-9 w-9 rounded-full border-2 border-primary/60 bg-primary/15" />
          <div className="h-1 w-12 rounded-full bg-muted-foreground/25" />
          <div className="h-1 w-9 rounded-full bg-muted-foreground/15" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="mx-auto aspect-[9/16] w-full max-w-[80px] overflow-hidden rounded-lg border border-border/50"
      aria-hidden
    >
      <div className="flex h-[42%] items-center justify-center border-b border-border/40 bg-secondary/40">
        <div className="h-7 w-7 rounded-full border-2 border-primary/60 bg-primary/15" />
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
                "flex flex-col rounded-xl border-2 p-3 text-left transition-colors sm:p-4",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                  : "border-border/40 hover:border-border/80"
              )}
            >
              <LayoutWireframe mode={opt.mode} />
              <p className="mt-3 text-sm font-semibold">{opt.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">{opt.hint}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
