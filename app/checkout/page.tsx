import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  // Public Web Payments config resolved server-side. This is app and location metadata only.
  const squareConfig = getSquareWebPaymentsConfig();
  return <CheckoutForm squareConfig={squareConfig} />;
}
