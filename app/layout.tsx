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
import { CONSENT_BOOTSTRAP } from "@/lib/consent/bootstrap";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  // Poppins paints the homepage LCP. The mono face is supporting UI copy, so
  // it can swap in without competing on the initial critical path.
  preload: false,
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
  weight: ["400", "700", "900"], // Body, bold, and the Black display cut the brand kit specifies.
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | New York Label",
    template: "%s | After Hours Agenda",
  },
  description: "After Hours Agenda is an independent New York label. Graphic tees, heavyweight hoods and crewnecks, drawn after hours and printed one at a time when you order.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda | New York Label",
    description: "Independent New York label. Graphic tees, heavyweight hoods and crewnecks, printed to order.",
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
    title: "After Hours Agenda | New York Label",
    description: "Independent New York label. Graphic tees, heavyweight hoods and crewnecks, printed to order.",
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
      suppressHydrationWarning
      className={`${jetBrainsMono.variable} ${littleFightOswald.variable} ${poppins.variable}`}
    >
      <head>
        <script id="aha-consent-bootstrap" dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }} />
      </head>
      <body className="origami-shell font-body text-cream antialiased">
        <SheepMarkSprite />
        <CartProvider>
          <a href="#main-content" className="fixed left-3 top-3 z-[500] -translate-y-24 bg-rose px-4 py-3 font-mono text-xs font-bold text-cream transition-transform focus:translate-y-0">Skip to content</a>
          <PlatformLayer />
          <GoogleAnalytics />
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
