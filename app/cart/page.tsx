import { CartPageContent } from "@/components/cart/CartPageContent";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";

export const metadata = {
  title: "Your Bag",
  description: "Your saved bag is unavailable while the next After Hours Agenda release is prepared.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageContent squareConfig={getSquareWebPaymentsConfig()} />;
}
