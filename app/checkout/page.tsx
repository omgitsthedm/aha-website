import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  if (!isStorefrontPublic()) {
    return (
      <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
        <div className="mx-auto max-w-3xl border-t-2 border-accent pt-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Store update</p>
          <h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,6rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Checkout is paused</h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">We&apos;re preparing the next release. Existing items are unavailable while the store is updated.</p>
        </div>
      </div>
    );
  }
  // Public Web Payments config resolved server-side. This is app and location metadata only.
  const squareConfig = getSquareWebPaymentsConfig();
  return <CheckoutForm squareConfig={squareConfig} />;
}
