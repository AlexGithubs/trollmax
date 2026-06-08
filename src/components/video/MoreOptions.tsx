import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  className?: string
  label?: string
}

export function MoreOptions({ children, className, label = "More options" }: Props) {
  return (
    <details
      className={cn(
        "group rounded-lg border border-border/30 bg-secondary/5 px-3 py-2 text-xs text-muted-foreground open:border-border/50 open:bg-secondary/10",
        className
      )}
    >
      <summary className="cursor-pointer list-none select-none marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="font-medium underline decoration-border/50 underline-offset-2 group-open:no-underline">
          {label}
        </span>
      </summary>
      <div className="mt-2 space-y-2 pl-0.5 leading-snug">{children}</div>
    </details>
  )
}
