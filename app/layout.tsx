import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { PilotNav } from "@/components/ui/PilotNav";
import { PilotFooter } from "@/components/ui/PilotFooter";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
  themeColor: "#1a1a1a",
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
      className={`${jetBrainsMono.variable} ${poppins.variable}`}
    >
      <body className="origami-shell font-body text-cream antialiased">
        <CartProvider>
          <a href="#main-content" className="fixed left-3 top-3 z-[500] -translate-y-24 bg-accent px-4 py-3 font-mono text-xs font-bold text-void transition-transform focus:translate-y-0">Skip to content</a>
          <PilotNav />
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
          <PilotFooter />
        </CartProvider>
      </body>
    </html>
  );
}
