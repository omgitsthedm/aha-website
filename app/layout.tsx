import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { Footer } from "@/components/ui/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { SubwayDotsBackground } from "@/components/ui/SubwayDotsBackground";

// Helvetica Neue — the Vignelli typeface (system font, zero download)
// IBM Plex Mono retained ONLY for prices, tabular data, and SplitFlap
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | Premium NYC Streetwear",
    template: "%s | After Hours Agenda",
  },
  description:
    "Premium streetwear from New York City. Every piece made to order with a story to tell.",
  keywords: [
    "streetwear", "NYC", "fashion", "urban", "clothing", "after hours",
    "premium", "made to order", "New York City", "streetwear brand",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.netlify.app"
  ),
  openGraph: {
    title: "After Hours Agenda",
    description: "Premium streetwear from New York City. Every piece made to order with a story to tell.",
    type: "website",
    locale: "en_US",
    siteName: "After Hours Agenda",
  },
  twitter: {
    card: "summary_large_image",
    title: "After Hours Agenda",
    description: "Premium streetwear from New York City. Every piece made to order with a story to tell.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={ibmPlexMono.variable}
    >
      <body className="text-cream font-body antialiased">
        {/* Global subway tile texture — fixed behind everything */}
        <div className="fixed inset-0 z-0 subway-tiles" aria-hidden="true" />
        {/* Animated MTA-colored dots flowing along invisible routes */}
        <SubwayDotsBackground />
        <CartProvider>
          <AnnouncementBar />
          <NavBar />
          <main className="relative z-[2] min-h-screen subway-tiles">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
