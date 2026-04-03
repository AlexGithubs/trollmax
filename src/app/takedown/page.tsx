import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "DMCA / Takedown — TROLLMAX",
  description: "Report unauthorized use of your voice or likeness on TROLLMAX.",
}

export default function TakedownPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-xl flex-1 px-4 py-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DMCA / Takedown Request</h1>
            <p className="text-sm text-muted-foreground">
              Report unauthorized use of your voice or likeness
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
          <p>
            We take intellectual property and consent violations seriously. Complete this form
            to request removal of content. By submitting, you affirm that the information
            provided is accurate and that you are authorized to make this request.
          </p>
        </div>

        {/* Takedown form — UI only, API route in future prompt */}
        <form className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              Your full name *
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Jane Smith"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Your email address *
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="jane@example.com"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="url">
              URL of the content to be removed *
            </label>
            <input
              id="url"
              type="url"
              required
              placeholder="https://trollmax.io/s/abc123"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="reason">
              Reason for removal *
            </label>
            <textarea
              id="reason"
              required
              rows={4}
              placeholder="Describe how your rights are being violated..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ownership">
              Statement of ownership / authorization *
            </label>
            <textarea
              id="ownership"
              required
              rows={3}
              placeholder="I am the owner / authorized representative of the voice/likeness in question..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              I have a good faith belief that the use of the material described above is not
              authorized by the copyright/rights owner, its agent, or the law. I understand
              that submitting a false claim may result in legal liability.
            </span>
          </label>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
            <strong>Note:</strong> Takedown form submission is not yet wired to our API.
            For urgent requests, email{" "}
            <a href="mailto:dmca@trollmax.io" className="underline">
              dmca@trollmax.io
            </a>{" "}
            directly.
          </div>

          <Button type="submit" className="w-full" disabled>
            Submit takedown request (coming soon)
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  )
}
