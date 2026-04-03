import Link from "next/link"
import { type LucideIcon } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ProductCardProps {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
  badge?: string
  ctaLabel: string
  ctaHref: string
  accent?: string
}

export function ProductCard({
  icon: Icon,
  title,
  description,
  features,
  badge,
  ctaLabel,
  ctaHref,
  accent = "text-primary",
}: ProductCardProps) {
  return (
    <Card className="flex flex-col border-border/60 bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-colors duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg bg-primary/10 p-2.5 ${accent}`}>
            <Icon className="h-6 w-6" />
          </div>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <h3 className="text-xl font-bold tracking-tight mt-3">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-primary">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {/* Clerk middleware will redirect to sign-in if unauthenticated */}
        <Button asChild className="w-full">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
