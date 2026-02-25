import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { Footer } from "@/components/ui/Footer";
import { CartProvider } from "@/components/cart/CartProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "After Hours Agenda | NYC Streetwear",
  description:
    "For the ones who stay out late. NYC-born streetwear for those who write their own rules.",
  keywords: ["streetwear", "NYC", "fashion", "urban", "clothing", "after hours"],
  openGraph: {
    title: "After Hours Agenda",
    description: "NYC-born streetwear for those who write their own rules.",
    type: "website",
    locale: "en_US",
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
      className={`${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-void text-cream font-body antialiased">
        <CartProvider>
          <AnnouncementBar />
          <NavBar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
