import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"
import { Analytics } from "@vercel/analytics/next"
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
  title: "TROLLMAX — Clone anyone. Troll everyone.",
  description:
    "Brainrot video generation & voice cloning soundboards for the meme economy.",
  openGraph: {
    title: "TROLLMAX",
    description:
      "Brainrot video generation & voice cloning soundboards for the meme economy.",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TROLLMAX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TROLLMAX — Clone anyone. Troll everyone.",
    description:
      "Brainrot video generation & voice cloning soundboards for the meme economy.",
    images: ["/og-image.png"],
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
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
