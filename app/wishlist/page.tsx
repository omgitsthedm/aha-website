import type { Metadata } from "next";
import { WishlistContent } from "@/components/wishlist/WishlistContent";

export const metadata: Metadata = {
  title: "Your Wishlist",
  description: "Pieces you've saved at After Hours Agenda, kept in this browser for later.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return <WishlistContent />;
}
