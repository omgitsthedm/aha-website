import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";

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
  description: "After Hours Agenda",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com"
  ),
  openGraph: {
    title: "After Hours Agenda",
    description: "After Hours Agenda",
    type: "website",
    locale: "en_US",
    siteName: "After Hours Agenda",
  },
  twitter: {
    card: "summary",
    title: "After Hours Agenda",
    description: "After Hours Agenda",
  },
  robots: {
    index: false,
    follow: false,
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
      <body className="font-body text-cream antialiased">
        <CartProvider>
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
