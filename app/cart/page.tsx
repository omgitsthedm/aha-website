import { CartPageContent } from "@/components/cart/CartPageContent";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";

export const metadata = {
  title: "Your Bag",
  description: "Review your shopping bag and proceed to checkout.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageContent squareConfig={getSquareWebPaymentsConfig()} />;
}
