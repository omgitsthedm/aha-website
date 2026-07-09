import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { Footer } from "@/components/ui/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { SubwayDotsBackground } from "@/components/ui/SubwayDotsBackground";

// IBM Plex Mono retained for prices, tabular data, and SplitFlap.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | Blacklight Grunge Streetwear",
    template: "%s | After Hours Agenda",
  },
  description:
    "Blacklight grunge graphic tees, loud color, and anti-boring streetwear from After Hours Agenda.",
  keywords: [
    "streetwear", "NYC", "fashion", "urban", "clothing", "after hours",
    "graphic tees", "blacklight grunge", "zine style", "New York City", "streetwear brand",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda | Blacklight Grunge Streetwear",
    description: "Graphic tees, loud color, and anti-boring streetwear from After Hours Agenda.",
    type: "website",
    locale: "en_US",
    siteName: "After Hours Agenda",
  },
  twitter: {
    card: "summary_large_image",
    title: "After Hours Agenda | Blacklight Grunge Streetwear",
    description: "Graphic tees, loud color, and anti-boring streetwear from After Hours Agenda.",
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
      data-theme={process.env.NEXT_PUBLIC_AHA_THEME || "blacklight"}
      className={ibmPlexMono.variable}
    >
      <head>
        {/* Preconnect to external image CDNs for faster LCP */}
        <link rel="preconnect" href="https://items-images-production.s3.us-west-2.amazonaws.com" />
        <link rel="dns-prefetch" href="https://items-images-production.s3.us-west-2.amazonaws.com" />
      </head>
      <body className="text-cream font-body antialiased zine-page">
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-[#FCCC0A] focus:text-[#141414] focus:px-4 focus:py-2 focus:font-body focus:font-bold focus:text-sm"
        >
          Skip to main content
        </a>
        {/* Fixed rough paper grid behind everything */}
        <div className="fixed inset-0 z-0 subway-tiles color-pop-grid" aria-hidden="true" />
        {/* Animated color flecks flowing behind the storefront */}
        <SubwayDotsBackground />
        <CartProvider>
          <AnnouncementBar />
          <NavBar />
          <main id="main-content" className="relative z-[2] min-h-[100dvh]">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
