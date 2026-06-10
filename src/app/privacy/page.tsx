import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

export const metadata = {
  title: "Privacy Policy — TROLLMAX",
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-10 sm:py-16">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information via Clerk (email, name)</li>
              <li>Audio samples you upload for voice cloning</li>
              <li>Generated audio and video files</li>
              <li>Usage data and server logs</li>
              <li>
                Product analytics when you accept our analytics banner (see{" "}
                <a href="#analytics" className="underline hover:text-foreground">
                  Analytics & cookies
                </a>
                )
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. How we use it</h2>
            <p>
              We use your data to provide the service, improve it, and communicate with you.
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Voice data</h2>
            <p>
              Voice samples and generated audio are stored in Vercel Blob storage.
              You can request deletion of your voice data at any time by submitting a
              takedown request or contacting us directly. We will process deletion requests
              within 30 days.
            </p>
          </section>

          <section id="analytics">
            <h2 className="text-lg font-semibold text-foreground">4. Analytics & cookies</h2>
            <p>
              We use{" "}
              <a
                href="https://posthog.com/privacy"
                className="underline hover:text-foreground"
                rel="noopener noreferrer"
                target="_blank"
              >
                PostHog
              </a>{" "}
              for product analytics. If you click <strong className="text-foreground">Accept analytics</strong>{" "}
              on our cookie banner, PostHog may set cookies and collect:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>Page views and navigation paths</li>
              <li>Button clicks and form interactions (autocapture)</li>
              <li>Custom product events such as starting a video, generating content, sharing, and purchasing credits</li>
              <li>Web performance metrics (Core Web Vitals)</li>
              <li>Session replays — recordings of how you use the app, with text inputs masked</li>
            </ul>
            <p className="mt-3">
              If you click <strong className="text-foreground">Decline</strong>, we do not send analytics
              events or session recordings to PostHog. Essential cookies for sign-in (Clerk) and
              payments (Stripe) still apply when you use those features.
            </p>
            <p className="mt-3">
              You can change your choice anytime by clearing site data for TROLLMAX in your browser;
              the banner will appear again on your next visit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Third-party services</h2>
            <p>
              We use Clerk for authentication, Stripe for payments, PostHog for analytics (with
              your consent), ElevenLabs for voice synthesis, Replicate for optional video captions,
              Modal for video compositing, and Vercel for hosting and storage. Each has their own
              privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data retention</h2>
            <p>
              We retain your data for as long as your account is active. Upon account deletion,
              we will delete your personal data within 30 days, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
            <p>
              For privacy questions or data deletion requests, email{" "}
              <a href="mailto:privacy@trollmax.io" className="underline hover:text-foreground">
                privacy@trollmax.io
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
