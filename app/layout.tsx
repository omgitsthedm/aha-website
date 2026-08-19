import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import localFont from "next/font/local";
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

// Self-hosted subsets (app/fonts/README.md). The mono face is supporting UI copy
// and the Oswald cut is the footer care bar, so neither is preloaded — but they
// are requested at top priority the moment their text lays out, so their bytes
// are cut to what the storefront draws. Anything outside the subset falls through
// to the system fallback via unicode-range.
const jetBrainsMono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020-007E, U+00A0, U+00A9, U+00B7, U+00D7, U+00E9, U+2013-2014, U+2018-2019, U+201C-201D, U+2022, U+2026, U+2192" }],
});

const littleFightOswald = localFont({
  src: "./fonts/Oswald-700-latin.woff2",
  weight: "700",
  style: "normal",
  variable: "--font-lf-oswald",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020-007E" }],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  // No <link rel=preload>: Chrome treats preloaded fonts as render-blocking
  // for a window after discovery, and under Lighthouse's frame cadence that
  // pushed first paint of static routes to the next 1 s tick (measured
  // FCP 1.3–2.4 s with fonts finished by 0.45 s). The @font-face is inlined in
  // the document CSS, so the fetch still starts during the first parse.
  preload: false,
  weight: ["400", "700", "900"], // Body, bold, and the Black display cut the brand kit specifies.
});

export const metadata: Metadata = {
  title: {
    default: "After Hours Agenda | For the dreamers and the doers",
    template: "%s | After Hours Agenda",
  },
  description: "After Hours Agenda is a clothing brand for the dreamers and the doers — graphic tees, heavyweight hoods and crewnecks, made to order, one at a time.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda | For the dreamers and the doers",
    description: "Graphic tees, heavyweight hoods and crewnecks, made to order — for you and the people you love.",
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
    title: "After Hours Agenda | For the dreamers and the doers",
    description: "Graphic tees, heavyweight hoods and crewnecks, made to order — for you and the people you love.",
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
