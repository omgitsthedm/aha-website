import { PageHeader } from "@/components/ui/PageHeader";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW } from "@/lib/commerce/policies";

export const metadata = { title: "Production and Free Shipping", description: "Review After Hours Agenda made-to-order production timing, free standard shipping, carrier delivery estimates, tracking, and the costs shown before payment.", alternates: { canonical: "/shipping" } };

export default function ShippingPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Made-to-order timeline" title="Shipping" description="Standard shipping is free on every order. Production happens first, then the carrier delivery window begins." />
      <dl className="border-t border-border/40">
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-black uppercase">Production</dt><dd className="text-sm leading-relaxed text-muted">Most orders are printed and prepared in <strong className="text-cream">{PRODUCTION_WINDOW}</strong>. Production can take longer during unusually high demand.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-black uppercase">Delivery</dt><dd className="text-sm leading-relaxed text-muted">Delivery is <strong className="text-cream">{DELIVERY_WINDOW}</strong>. The carrier and destination determine the exact timing.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-black uppercase">Tracking</dt><dd className="text-sm leading-relaxed text-muted">Tracking is sent to the checkout email after the package ships. Contact support with the order number if the tracking link does not arrive.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-black uppercase">At checkout</dt><dd className="text-sm leading-relaxed text-muted">The final order total, free standard shipping line, and estimated tax are shown before payment.</dd></div>
      </dl>
    </div></div>
  );
}
