import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

export const metadata = {
  title: "Privacy Policy — TROLLMAX",
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-16">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: March 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information via Clerk (email, name)</li>
              <li>Audio samples you upload for voice cloning</li>
              <li>Generated audio and video files</li>
              <li>Usage data and logs</li>
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

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Third-party services</h2>
            <p>
              We use Clerk for authentication, Stripe for payments, Modal and/or Replicate
              for GPU inference, and Vercel for hosting and storage. Each has their own
              privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Data retention</h2>
            <p>
              We retain your data for as long as your account is active. Upon account deletion,
              we will delete your personal data within 30 days, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
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
