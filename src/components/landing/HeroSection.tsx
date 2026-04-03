import Link from "next/link"
import { Mic2, Sparkles, Video, Zap } from "lucide-react"
import { ProductCard } from "./ProductCard"
import { ConsentBanner } from "./ConsentBanner"
import { LandingInteractiveDemos } from "./LandingInteractiveDemos"
import { formatCurrencyCost } from "@/lib/billing/currency-display"
import { Button } from "@/components/ui/button"

const steps = [
  {
    icon: Sparkles,
    title: "Write the chaos",
    body: "Full script for a 9:16 video, or punchy phrases for a one-tap soundboard.",
  },
  {
    icon: Mic2,
    title: "Pick a voice",
    body: "Use a preset or upload a short sample — same engine powers boards and videos.",
  },
  {
    icon: Video,
    title: "Share the link",
    body: "Public URLs for videos and boards — copy, send, repeat.",
  },
] as const

export function HeroSection() {
  return (
    <>
      <div className="relative overflow-hidden">
        <div className="landing-aurora pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="landing-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/25 blur-[100px] landing-blob"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 right-[-20%] h-[320px] w-[320px] rounded-full bg-primary/15 blur-[90px] landing-blob-delay max-lg:hidden"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-14 sm:pb-12 sm:pt-20 md:pt-24">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
              <Zap className="size-3.5 fill-primary" aria-hidden />
              Brainrot video and voice cloning for the meme economy
            </div>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl">
              <span className="block">Clone anyone.</span>
              <span className="landing-title-shimmer mt-1 block sm:mt-2">
                Troll everyone.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Turn a face and script into a{" "}
              <span className="text-foreground/90">scroll-stopping 9:16 video</span> with backgrounds
              and captions — or a voice into a one-tap soundboard. Built for jokes, not corporate
              webinars.
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="h-12 min-w-[11rem] px-8 text-base shadow-lg shadow-primary/20">
                <Link href="/app/video/new">Make a video</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 min-w-[11rem] border-primary/35 bg-background/50 px-8 text-base backdrop-blur-sm hover:bg-primary/10"
              >
                <Link href="/app/soundboard/new">Build a soundboard</Link>
              </Button>
            </div>
            <p className="mt-4 max-w-md text-xs text-muted-foreground sm:max-w-lg">
              Both tools include free tries before you spend credits.{" "}
              <Link href="/pricing" className="underline-offset-2 hover:text-foreground hover:underline">
                Pricing & banana credits
              </Link>
              {" · "}
              Sign in when you&apos;re ready.
            </p>
          </div>
        </div>
      </div>

      <LandingInteractiveDemos />

      <section
        className="border-y border-border/40 bg-card/20 py-16 backdrop-blur-[2px]"
        aria-labelledby="how-it-works-heading"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            id="how-it-works-heading"
            className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
          >
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
            Three steps from idea to shareable link. No video editor required.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-border/50 bg-background/40 p-6 text-center shadow-sm transition-colors hover:border-primary/25"
              >
                <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="absolute right-4 top-4 font-mono text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pick your weapon</h2>
          <p className="mt-2 text-muted-foreground">
            Same account, two engines — video for the algorithm, sound for the group chat.
          </p>
        </div>
        <div className="mb-12 grid gap-6 sm:grid-cols-2">
          <ProductCard
            icon={Video}
            title="Brainrot Video Generator"
            description="Script + headshot + background → 9:16 video: TTS (ElevenLabs or Replicate), D-ID talking head, optional captions from Replicate Whisper, then FFmpeg compositing (Modal)."
            features={[
              "Optional on-screen captions timed to your narration (Replicate Whisper)",
              "Backgrounds include Subway Surfers, Minecraft, and more",
              "9:16 portrait for TikTok / Reels / Shorts",
              "Public share link — /v/your-id",
              `Costs ${formatCurrencyCost(2)} per generate`,
            ]}
            badge={formatCurrencyCost(2)}
            ctaLabel="Generate a video"
            ctaHref="/app/video/new"
          />
          <ProductCard
            icon={Mic2}
            title="Voice Cloning Soundboard"
            description="Pick a preset voice or upload a sample, type your phrases, and generate clips for a shareable board — ElevenLabs for presets, Replicate F5-TTS for custom uploads."
            features={[
              "Uploads: ~10–20s of clear speech works best",
              "You write the phrases — we synthesize each clip with your voice",
              "Public share link — /s/your-id",
              `Costs ${formatCurrencyCost(1)} per generate`,
            ]}
            badge={formatCurrencyCost(1)}
            ctaLabel="Build your soundboard"
            ctaHref="/app/soundboard/new"
          />
        </div>

        <ConsentBanner />
      </section>
    </>
  )
}
