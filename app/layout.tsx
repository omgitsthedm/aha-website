import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { PilotNav } from "@/components/ui/PilotNav";
import { PilotFooter } from "@/components/ui/PilotFooter";
import { getAllProducts } from "@/lib/square/catalog";

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
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fafafa",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lightweight index for the header search overlay. getAllProducts is
  // request-cached, so pages that also fetch the catalog pay no extra call.
  let searchIndex: { name: string; slug: string; priceFormatted: string; image: string }[] = [];
  try {
    const products = await getAllProducts();
    searchIndex = products.map((p) => ({
      name: p.name,
      slug: p.slug,
      priceFormatted: p.priceFormatted,
      image: p.images[0] || "",
    }));
  } catch {
    // Search degrades to empty results; shopping is unaffected.
  }

  return (
    <html
      lang="en"
      data-theme={process.env.NEXT_PUBLIC_AHA_THEME || "newsstand"}
      className={`${jetBrainsMono.variable} ${poppins.variable}`}
    >
      <body className="origami-shell font-body text-cream antialiased">
        <CartProvider>
          <a href="#main-content" className="fixed left-3 top-3 z-[500] -translate-y-24 bg-rose px-4 py-3 font-mono text-xs font-bold text-cream transition-transform focus:translate-y-0">Skip to content</a>
          <PilotNav searchIndex={searchIndex} />
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
          <PilotFooter />
        </CartProvider>
      </body>
    </html>
  );
}
