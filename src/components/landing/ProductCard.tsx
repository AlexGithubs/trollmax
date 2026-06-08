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

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="text-primary">✓</span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  )
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
  const previewFeatures = features.slice(0, 2)
  const extraFeatures = features.slice(2)

  return (
    <Card size="compact" className="flex flex-col border-border/60 bg-card/50 backdrop-blur-sm transition-colors duration-200 hover:border-primary/40 sm:py-6">
      <CardHeader size="compact" className="pb-4 sm:px-6">
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
        <h3 className="mt-3 text-xl font-bold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent size="compact" className="flex-1 sm:px-6">
        <div className="sm:hidden">
          <FeatureList features={previewFeatures} />
          {extraFeatures.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                +{extraFeatures.length} more features
              </summary>
              <div className="mt-2">
                <FeatureList features={extraFeatures} />
              </div>
            </details>
          )}
        </div>
        <div className="hidden sm:block">
          <FeatureList features={features} />
        </div>
      </CardContent>

      <CardFooter className="px-4 sm:px-6">
        <Button asChild className="w-full">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
