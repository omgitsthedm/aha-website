import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { Footer } from "@/components/ui/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { StorefrontJsonLd } from "@/components/seo/StorefrontJsonLd";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  variable: "--font-ibm-plex-condensed",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda",
    template: "%s | After Hours Agenda",
  },
  description:
    "Shop clothing and accessories from After Hours Agenda, with standard shipping included and clear fit guidance.",
  keywords: [
    "streetwear", "NYC", "fashion", "urban", "clothing", "after hours",
    "graphic tees", "independent fashion", "New York City", "streetwear brand",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda",
    description: "Shop clothing and accessories with standard shipping included and clear product details.",
    type: "website",
    locale: "en_US",
    siteName: "After Hours Agenda",
  },
  twitter: {
    card: "summary_large_image",
    title: "After Hours Agenda",
    description: "Shop clothing and accessories with standard shipping included and clear product details.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080a09",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme={process.env.NEXT_PUBLIC_AHA_THEME || "newsstand"}
      className={`${ibmPlexMono.variable} ${ibmPlexCondensed.variable}`}
    >
      <head>
        {/* Preconnect to external image CDNs for faster LCP */}
        <link rel="preconnect" href="https://items-images-production.s3.us-west-2.amazonaws.com" />
        <link rel="dns-prefetch" href="https://items-images-production.s3.us-west-2.amazonaws.com" />
      </head>
      <body className="aha-page font-body text-cream antialiased">
        <StorefrontJsonLd />
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[9999] focus:bg-accent focus:px-4 focus:py-3 focus:font-body focus:text-sm focus:font-bold focus:text-void"
        >
          Skip to main content
        </a>
        {/* Quiet registration grid behind the shared wireframe. */}
        <div className="registration-grid fixed inset-0 z-0" aria-hidden="true" />
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
