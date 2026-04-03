import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const isProd = process.env.NODE_ENV === "production"

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  // Clerk uses package subpath exports / #imports that fail when webpack bundles the server graph.
  // Native/binary tooling: keep external so Next does not bundle `.node` / ffmpeg incorrectly.
  serverExternalPackages: ["@clerk/backend", "sharp", "fluent-ffmpeg", "ffmpeg-static"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps to Sentry for readable stack traces in production.
  // Requires SENTRY_AUTH_TOKEN to be set (add to Vercel environment variables).
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Automatically tree-shake Sentry logger statements in production.
  disableLogger: true,
  // Upload source maps but don't include them in the client bundle.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
})
