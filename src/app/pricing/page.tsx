import Link from "next/link"
import Image from "next/image"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Button } from "@/components/ui/button"
import { currencyIconSrc } from "@/lib/billing/currency-display"
import { VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK } from "@/lib/billing/video-generation-cost"
import {
  ENTERPRISE_CREDIT_OFFERING,
  FEATURED_CREDIT_PACK_ID,
  getCreditPacksForPublic,
} from "@/lib/billing/credit-packs"
import { cn } from "@/lib/utils"
import { Check, ThumbsUp } from "lucide-react"

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

export const metadata = {
  title: "Pricing — TROLLMAX",
  description: "Banana credits and Enterprise.",
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

export default function PricingPage() {
  const packs = getCreditPacksForPublic()
  const ent = ENTERPRISE_CREDIT_OFFERING

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 md:py-24 lg:px-10 lg:py-28">
          <header className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
            <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[3.25rem]">
              Choose your plan
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              One-time credit packs. Everyone starts with 5 free{" "}
              <Image
                src={currencyIconSrc()}
                alt=""
                width={18}
                height={18}
                className="inline-block align-text-bottom opacity-90"
              />
              .
            </p>
          </header>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-4 xl:items-stretch xl:gap-5">
            {packs.map((p) => {
              const featured = p.id === FEATURED_CREDIT_PACK_ID
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative flex min-h-[520px] flex-col rounded-3xl p-7 sm:p-8",
                    featured
                      ? "border-2 border-primary/55 bg-gradient-to-b from-primary/[0.16] via-primary/[0.06] to-[oklch(0.14_0.02_300)] shadow-[0_0_0_1px_oklch(0.55_0.2_300/0.15),0_0_56px_-12px_oklch(0.55_0.22_300/0.35)]"
                      : "border border-white/[0.08] bg-[oklch(0.145_0.01_280)]"
                  )}
                >
                  {featured ? (
                    <div
                      className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25"
                      aria-hidden
                    >
                      <ThumbsUp className="h-5 w-5 text-white" strokeWidth={2.2} />
                    </div>
                  ) : null}

                  <div className={cn("pr-12", !featured && "pr-0")}>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {p.label}
                    </h2>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                      <p className="text-sm text-muted-foreground">
                        {p.credits} credits
                      </p>
                      <Pill>One-time · yours to keep</Pill>
                    </div>
                  </div>

                  <p className="mt-8 text-[2.25rem] font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-4xl">
                    {money(p.priceUsd)}
                  </p>

                  <div className="mt-8">
                    <Button
                      asChild
                      size="lg"
                      className={cn(
                        "h-12 w-full rounded-xl text-sm font-semibold",
                        featured && "shadow-md shadow-primary/20"
                      )}
                      variant={featured ? "default" : "outline"}
                    >
                      <Link href={`/pricing/checkout?pack=${p.id}`}>Buy credits</Link>
                    </Button>
                  </div>

                  <ul className="mt-8 flex flex-1 flex-col gap-3.5 text-[13px] leading-snug text-foreground/85 md:text-sm">
                    {p.features.map((line) => (
                      <li key={line} className="flex gap-3">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          strokeWidth={2.5}
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            {/* Enterprise — fourth column, warm gradient accent */}
            <div
              id="enterprise"
              className="relative flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[oklch(0.145_0.01_280)] scroll-mt-24"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-orange-950/[0.55]"
                aria-hidden
              />
              <div className="relative flex h-full flex-col p-7 sm:p-8">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {ent.label}
                </h2>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <p className="text-sm text-muted-foreground">{ent.tagline}</p>
                  <Pill>Custom agreement</Pill>
                </div>

                <p className="mt-8 text-[2.25rem] font-bold leading-none tracking-tight text-foreground sm:text-4xl">
                  Let&apos;s talk
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Tailored pricing for your org</p>

                <div className="mt-8">
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 w-full rounded-xl border-white/15 bg-white/[0.03] text-sm font-semibold hover:bg-white/[0.07]"
                  >
                    <a href={ent.mailtoHref}>{ent.cta}</a>
                  </Button>
                </div>

                <ul className="mt-8 flex flex-1 flex-col gap-3.5 text-[13px] leading-snug text-foreground/85 md:text-sm">
                  {ent.bullets.map((line) => (
                    <li key={line} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90"
                        strokeWidth={2.5}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-2xl text-center md:mt-24">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              How credits are spent
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem] md:leading-relaxed">
              Video: 2{" "}
              <Image
                src={currencyIconSrc()}
                alt=""
                width={14}
                height={14}
                className="inline-block align-text-bottom opacity-90"
              />{" "}
              for the first {VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK} script characters, +1{" "}
              <Image
                src={currencyIconSrc()}
                alt=""
                width={14}
                height={14}
                className="inline-block align-text-bottom opacity-90"
              />{" "}
              per {VIDEO_SCRIPT_CHARS_PER_CREDIT_BLOCK} after. Soundboard: 1{" "}
              <Image
                src={currencyIconSrc()}
                alt=""
                width={14}
                height={14}
                className="inline-block align-text-bottom opacity-90"
              />
              ; expansion (12 phrases / longer text) +0.5{" "}
              <Image
                src={currencyIconSrc()}
                alt=""
                width={14}
                height={14}
                className="inline-block align-text-bottom opacity-90"
              />
              .
            </p>
          </div>

          <p className="mt-14 text-center text-[10px] text-muted-foreground/50">
            Credit packs bill via Stripe — see{" "}
            <code className="rounded bg-white/[0.04] px-1.5 py-0.5">.env.example</code>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
