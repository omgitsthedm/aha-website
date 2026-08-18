import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW, SHIPPING_CLAIM_SENTENCE } from "@/lib/commerce/policies";

export const metadata = buildMetadata({
  title: "Shipping",
  description: "After Hours Agenda shipping: free in the US, $25 flat rate international, printed to order and shipped with tracking.",
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Shipping" title="Shipping information" description={`${SHIPPING_CLAIM_SENTENCE} Every piece is made to order — production takes ${PRODUCTION_WINDOW}, and delivery is ${DELIVERY_WINDOW}.`} />
      <dl className="border-t border-border/40">
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Rates</dt><dd className="text-sm leading-relaxed text-muted">{SHIPPING_CLAIM_SENTENCE} We ship to the US, Canada, the UK, Ireland, most of the EU, Switzerland, Norway, Türkiye, Japan and Australia. International orders ship DDU: any import VAT or duties are collected by the carrier on delivery.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Timing</dt><dd className="text-sm leading-relaxed text-muted">Production takes {PRODUCTION_WINDOW} because nothing is printed until you order it. Delivery is {DELIVERY_WINDOW}.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Tracking</dt><dd className="text-sm leading-relaxed text-muted">Use the order number and checkout email on the <Link href="/track-order" className="text-accent underline underline-offset-4">Track Order page</Link>. A tracking link appears once it is available for that shipment.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Address changes</dt><dd className="text-sm leading-relaxed text-muted">Contact support with the order number and corrected address. Because each piece is printed to order, a change is only possible before production starts.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Delivery questions</dt><dd className="text-sm leading-relaxed text-muted">Carrier conditions and destination details can affect delivery. Contact support with the order number for help with a specific shipment.</dd></div>
      </dl>
    </div></div>
  );
}
