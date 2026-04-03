import { ShieldCheck } from "lucide-react"

export function ConsentBanner() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Consent-first, always. </span>
          TROLLMAX is built for entertainment and creative content only. Only clone voices
          you have explicit permission to clone. Never use this platform to impersonate,
          defraud, or harm anyone. Unauthorized use of real people&apos;s voices may
          violate platform terms, applicable law, and our{" "}
          <a href="/terms" className="underline hover:text-foreground transition-colors">
            Terms of Service
          </a>
          . Report misuse via our{" "}
          <a href="/takedown" className="underline hover:text-foreground transition-colors">
            takedown page
          </a>
          .
        </div>
      </div>
    </div>
  )
}
