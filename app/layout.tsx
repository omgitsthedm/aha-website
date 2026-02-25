import type { Metadata } from "next";
import { Syne, DM_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";
import { FilmGrain } from "@/components/ui/FilmGrain";
import { Footer } from "@/components/ui/Footer";
import { CartProvider } from "@/components/cart/CartProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
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
      className={`${syne.variable} ${dmSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="bg-void text-cream font-body antialiased">
        <CartProvider>
          <FilmGrain />
          <NavBar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
