import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { InsetDebug } from "@/components/inset-debug";

// Geist Mono is the only font, as on zot.sh.
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_URL = "https://web.zot.sh";
const TITLE = "zot";
const DESCRIPTION = "Browser client for zot continuous hosts.";

// Icons and the share image are the same assets as zot.sh.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "zot",
  // Connection details are private; the client is not meant for indexing.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "zot", statusBarStyle: "black" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "zot",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "zot. Yet another coding agent harness." }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iOS zooms into focused inputs and keeps the page zoomed afterwards.
  // Inputs use 16px on touch devices (globals.css) and the scale is fixed.
  maximumScale: 1,
  userScalable: false,
  // Needed for env(safe-area-inset-*) to report real values; without it
  // the bottom inset is 0 and the footer runs into the rounded corners and
  // home indicator. With the opaque status bar the top inset stays 0, so
  // the page still starts below the status bar.
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${mono.variable}`} style={{ colorScheme: "dark" }}>
      <head>
        {/* Next.js only emits the newer mobile-web-app-capable tag. iOS
            still keys standalone mode off the apple-prefixed one. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <InsetDebug />
      </body>
    </html>
  );
}
