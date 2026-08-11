import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Oswald, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteNav } from "@/components/ui/SiteNav";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { PlatformLayer } from "@/components/ui/PlatformLayer";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SocialPixels } from "@/components/analytics/SocialPixels";
import { StorefrontJsonLd } from "@/components/seo/StorefrontJsonLd";
import { ConsentIdentifierCleanup } from "@/components/seo/ConsentIdentifierCleanup";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { LazyFeedbackWidget } from "@/components/feedback/LazyFeedbackWidget";
import { LittleFightCareBar } from "@/components/ui/LittleFightCareBar";
import { SheepMarkSprite } from "@/components/ui/SheepMark";
import { SHIPPING_CLAIM_SHORT } from "@/lib/commerce/policies";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

const littleFightOswald = Oswald({
  subsets: ["latin"],
  variable: "--font-lf-oswald",
  display: "swap",
  preload: false,
  weight: ["700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "700"], // Only weights used by the storefront; avoid two unnecessary preloads.
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | NYC Streetwear",
    template: "%s | After Hours Agenda",
  },
  // Shipping claim comes from lib/commerce/policies.ts, never hand-written:
  // $20 is charged on CA/GB/AU orders, so "free shipping" unqualified is false.
  // These three surfaces are length-capped (SERP snippet, OG card, Twitter card),
  // so they carry SHIPPING_CLAIM_SHORT — the qualifier that fits — rather than
  // SHIPPING_CLAIM_SENTENCE, which pushes the description past 160 characters.
  description: `After Hours Agenda — expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. ${SHIPPING_CLAIM_SHORT}. Secure Square checkout.`,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda | NYC Streetwear",
    description: `Expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. ${SHIPPING_CLAIM_SHORT}. Secure Square checkout.`,
    type: "website",
    // Deliberately NO `url` here. Next only overwrites the keys a child segment
    // actually declares (`resolve-metadata.js` iterates `for (const key in
    // source)`), so a root-level `openGraph.url` is inherited verbatim by every
    // page that does not declare its own openGraph. That would make child pages
    // advertise the homepage as their share canonical. og:url belongs per-page,
    // from the `path` argument in components/seo/buildMetadata.ts.
    locale: "en_US",
    siteName: "After Hours Agenda",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "After Hours Agenda — script logo and the black sheep" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "After Hours Agenda | NYC Streetwear",
    description: `Expressive everyday clothing from New York. Loud graphics, dependable garments, printed to order. ${SHIPPING_CLAIM_SHORT}. Secure Square checkout.`,
    images: ["/brand/og-image.png"],
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
      className={`${jetBrainsMono.variable} ${littleFightOswald.variable} ${poppins.variable}`}
    >
      <body className="origami-shell font-body text-cream antialiased">
        <SheepMarkSprite />
        <CartProvider>
          <a href="#main-content" className="fixed left-3 top-3 z-[500] -translate-y-24 bg-rose px-4 py-3 font-mono text-xs font-bold text-cream transition-transform focus:translate-y-0">Skip to content</a>
          <PlatformLayer />
          <GoogleAnalytics />
          {/*
            The Meta pixel stays. It is a deliberate keep, not drift: it is
            env-gated (NEXT_PUBLIC_META_PIXEL_ID) and consent-gated (nothing
            loads until consent === "granted"), it feeds the live product feed's
            retargeting audience, and lib/analytics/events.ts already mirrors the
            GA4 `purchase` to Meta `Purchase` with an eventID for CAPI de-dup.
            Pulling the id would silently break an existing catalog/retargeting
            setup — a marketing decision, not a technical one. Still open, and
            owned outside this file: ViewContent / AddToCart / InitiateCheckout
            mirrors in the same helper, the CAPI send, and app/privacy/page.tsx,
            which names a TikTok pixel that never runs (no TikTok id is set).
          */}
          <SocialPixels />
          <ConsentIdentifierCleanup />
          <StorefrontJsonLd />
          <SiteNav />
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
          <SiteFooter />
          <LittleFightCareBar />
          <CookieConsent />
          <LazyFeedbackWidget />
        </CartProvider>
      </body>
    </html>
  );
}
