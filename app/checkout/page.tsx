import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout | After Hours Agenda",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  // Public Web Payments config resolved server-side (no secrets — app id + location only).
  const squareConfig = getSquareWebPaymentsConfig();
  return <CheckoutForm squareConfig={squareConfig} />;
}
