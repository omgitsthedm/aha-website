import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { MetaCheckoutPrefill } from "@/components/checkout/MetaCheckoutPrefill";
import { isCheckoutOpen } from "@/lib/commerce/catalog-policy";
import { resolveMetaCheckoutItems } from "@/lib/commerce/meta-checkout";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isCheckoutOpen()) {
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
  // Meta Shop hand-off: /checkout?products=SKU:QTY,… (retailer ids from
  // /feeds/meta). Resolved against the live catalog server-side; anything
  // unknown is skipped and a plain visit renders checkout unchanged.
  const params = await searchParams;
  const productsParam = Array.isArray(params.products) ? params.products[0] : params.products;
  const prefillItems = productsParam ? await resolveMetaCheckoutItems(productsParam) : [];

  // Public Web Payments config resolved server-side. This is app and location metadata only.
  const squareConfig = getSquareWebPaymentsConfig();
  return (
    <>
      {prefillItems.length > 0 ? <MetaCheckoutPrefill items={prefillItems} /> : null}
      <CheckoutForm squareConfig={squareConfig} />
    </>
  );
}
