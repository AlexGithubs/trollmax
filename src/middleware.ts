import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher(["/app(.*)"])

// These form pages are intentionally browsable without auth.
// Auth is enforced at the "Generate" action instead.
const isPublicFormRoute = createRouteMatcher([
  "/app/video/new",
  "/app/soundboard/new",
])

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req) && !isPublicFormRoute(req)) {
      await auth.protect()
    }
  },
  {
    contentSecurityPolicy: {
      directives: {
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https://img.clerk.com",
          "https://*.public.blob.vercel-storage.com",
        ],
        "media-src": ["'self'", "blob:", "data:", "https:", "http:"],
        "connect-src": [
          "'self'",
          "https://*.public.blob.vercel-storage.com",
          "https://api.stripe.com",
        ],
      },
    },
  }
)

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
