import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Video, Sparkles } from "lucide-react"
import { ProCheckoutButtons } from "./ProCheckoutButtons"
import { PLANS } from "@/lib/stripe"

export function VideoPaywallCard() {
  const p = PLANS.pro
  return (
    <Card className="border-primary/40 bg-gradient-to-b from-primary/5 to-card/50 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <span className="font-semibold">Brainrot Video Generator</span>
          <Badge className="ml-auto">Pro</Badge>
        </div>
        <p className="text-sm text-muted-foreground pt-1">
          Write a script, pick a voice and background, and export shareable brainrot videos. This
          feature requires an active Pro subscription.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            Video voices: full preset library + any soundboard you&apos;ve made
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            Cancel anytime in the customer portal
          </li>
        </ul>
        <ProCheckoutButtons
          monthlyLabel={`Subscribe — $${p.monthlyUsd}/mo`}
          yearlyLabel={`Subscribe yearly — $${p.yearlyUsd}/yr (${p.yearlyEffectiveMonthlyUsd}/mo)`}
          savingsNote={`Yearly saves about ${p.yearlySavingsPercent}% vs paying monthly.`}
        />
        <p className="text-center text-xs text-muted-foreground">
          Pay-per-export coming later. Questions?{" "}
          <a href="mailto:hello@trollmax.io" className="underline hover:text-foreground">
            Contact us
          </a>
        </p>
        <Button variant="outline" className="w-full text-xs" asChild>
          <Link href="/pricing">View full pricing</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
