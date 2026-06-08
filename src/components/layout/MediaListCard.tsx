import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MediaListCardProps = {
  icon: LucideIcon
  title: string
  titleHref: string
  subtitle: string
  badge: { label: string; className: string }
  actions: React.ReactNode
  deleteAction: React.ReactNode
  className?: string
}

export function MediaListCard({
  icon: Icon,
  title,
  titleHref,
  subtitle,
  badge,
  actions,
  deleteAction,
  className,
}: MediaListCardProps) {
  return (
    <Card
      size="compact"
      className={cn("min-w-0 overflow-hidden border-border/60 bg-card/50", className)}
    >
      <CardHeader size="compact" className="pb-0">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <Link
              href={titleHref}
              className="block w-full min-w-0 truncate font-semibold hover:underline"
            >
              {title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              badge.className
            )}
          >
            {badge.label}
          </span>
        </div>
      </CardHeader>
      <CardContent size="compact" className="flex items-center gap-2 pt-2">
        <div className="flex min-w-0 flex-1 gap-2">{actions}</div>
        {deleteAction}
      </CardContent>
    </Card>
  )
}

export function MediaListPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
