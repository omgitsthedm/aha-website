import type { Metadata } from "next";
import { WishlistContent } from "@/components/wishlist/WishlistContent";

export const metadata: Metadata = {
  title: "Your Wishlist",
  description: "The After Hours Agenda wishlist is paused while the next collection is developed.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return <WishlistContent />;
}
