import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mic2, Video, ArrowRight } from "lucide-react"
import { currencyIconAlt, currencyIconSrc } from "@/lib/billing/currency-display"

export const metadata = {
  title: "Dashboard — TROLLMAX",
}

export default async function AppDashboard() {
  const user = await currentUser()
  const firstName = user?.firstName ?? "there"

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">What do you want to create today?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card data-tour="dashboard-video-card" className="border-border/60 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <span className="font-semibold">Brainrot Video Generator</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                2{" "}
                <img src={currencyIconSrc()} alt={currencyIconAlt()} className="ml-1 inline h-3.5 w-3.5 object-contain" />
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Write a script, pick a background, export a viral video.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/app/video/new">
                Create video <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mic2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Voice Cloning Soundboard</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                1 / 1.5{" "}
                <img src={currencyIconSrc()} alt={currencyIconAlt()} className="ml-1 inline h-3.5 w-3.5 object-contain" />
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Clone a voice, generate clips, and share your soundboard.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/app/soundboard/new">
                Create soundboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
