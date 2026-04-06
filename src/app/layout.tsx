import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { getMetadataBase } from "@/lib/site-url"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "TROLLMAX — Clone anyone. Troll everyone.",
  description:
    "Brainrot video generation & voice cloning soundboards for the meme economy.",
  openGraph: {
    title: "TROLLMAX",
    description:
      "Brainrot video generation & voice cloning soundboards for the meme economy.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TROLLMAX — Clone anyone. Troll everyone.",
    description:
      "Brainrot video generation & voice cloning soundboards for the meme economy.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
        >
          {children}
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
