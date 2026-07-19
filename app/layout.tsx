import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { PilotNav } from "@/components/ui/PilotNav";
import { PilotFooter } from "@/components/ui/PilotFooter";
import { PlatformLayer } from "@/components/ui/PlatformLayer";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SocialPixels } from "@/components/analytics/SocialPixels";
import { StorefrontJsonLd } from "@/components/seo/StorefrontJsonLd";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "700"], // 500/600 are unused site-wide
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | NYC Streetwear",
    template: "%s | After Hours Agenda",
  },
  description:
    "After Hours Agenda — expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. Free shipping. Secure Square checkout.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda | NYC Streetwear",
    description:
      "Expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. Free shipping. Secure Square checkout.",
    type: "website",
    locale: "en_US",
    siteName: "After Hours Agenda",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "After Hours Agenda — script logo and the black sheep" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "After Hours Agenda | NYC Streetwear",
    description:
      "Expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. Free shipping. Secure Square checkout.",
    images: ["/brand/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  // Installed-app polish: standalone window with the brand-rose chrome
  // (status bar stays legible dark-on-rose). The home-screen icon itself comes
  // from the file conventions app/icon.svg + app/apple-icon.png.
  appleWebApp: {
    capable: true,
    title: "After Hours Agenda",
    statusBarStyle: "default",
  },
  other: {
    "msapplication-TileColor": "#FF6B6B",
    "msapplication-navbutton-color": "#FF6B6B",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  // Browser chrome carries the brand rose (Safari 15+ tab bar, Chrome/Edge,
  // Android PWA header, Discord embed strip). Page ground stays paper #FAFAFA.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF6B6B" },
    { media: "(prefers-color-scheme: dark)", color: "#CE3D56" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${poppins.variable}`}
    >
      <body className="origami-shell font-body text-cream antialiased">
        <CartProvider>
          <a href="#main-content" className="fixed left-3 top-3 z-[500] -translate-y-24 bg-rose px-4 py-3 font-mono text-xs font-bold text-cream transition-transform focus:translate-y-0">Skip to content</a>
          <PlatformLayer />
          <GoogleAnalytics />
          <SocialPixels />
          <StorefrontJsonLd />
          <PilotNav />
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
          <PilotFooter />
          <CookieConsent />
          <FeedbackWidget />
        </CartProvider>
      </body>
    </html>
  );
}
