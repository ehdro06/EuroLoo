import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import StoreProvider from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper"
import { GlobalLoading } from "@/components/global-loading"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EuroLoo - Privacy-First Public Toilet Finder",
  description: "Find public toilets across Europe. Privacy-friendly, no tracking, powered by open data.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    url: "https://euroloo.app",
    title: "EuroLoo",
    description: "Find free toilets near you",
    siteName: "EuroLoo",
    images: [{ url: "/icon.svg" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProviderWrapper>
      <html lang="en">
        <body className="font-sans antialiased">
          <StoreProvider>
            {children}
            <Analytics />
            <Toaster />
            <GlobalLoading />
          </StoreProvider>
        </body>
      </html>
    </ClerkProviderWrapper>
  )
}

