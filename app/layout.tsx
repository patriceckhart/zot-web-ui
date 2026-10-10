import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

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
  appleWebApp: { capable: true, title: "zot", statusBarStyle: "black-translucent" },
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
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${mono.variable}`} style={{ colorScheme: "dark" }}>
      <body>{children}</body>
    </html>
  );
}
