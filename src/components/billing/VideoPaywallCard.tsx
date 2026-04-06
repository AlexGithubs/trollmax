import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Video, Sparkles } from "lucide-react"
import { FEATURED_CREDIT_PACK_ID } from "@/lib/billing/credit-packs"

export function VideoPaywallCard() {
  const pack = FEATURED_CREDIT_PACK_ID
  return (
    <Card className="border-primary/40 bg-gradient-to-b from-primary/5 to-card/50 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <span className="font-semibold">Brainrot Video Generator</span>
          <Badge className="ml-auto">Credits</Badge>
        </div>
        <p className="text-sm text-muted-foreground pt-1">
          Write a script, pick a voice and background, and export shareable brainrot videos. Each run
          spends banana credits from your balance — grab a pack when you need more.
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
            One-time packs — credits stay on your account
          </li>
        </ul>
        <Button className="w-full" asChild>
          <Link href={`/pricing/checkout?pack=${pack}`}>Buy credits</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:hello@trollmax.io" className="underline hover:text-foreground">
            Contact us
          </a>
        </p>
        <Button variant="outline" className="w-full text-xs" asChild>
          <Link href="/pricing">View all packs</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
