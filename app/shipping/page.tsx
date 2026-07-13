import { PageHeader } from "@/components/ui/PageHeader";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW } from "@/lib/commerce/policies";
import Link from "next/link";

export const metadata = { title: "Production and Free Shipping", description: "Review After Hours Agenda made-to-order production timing, free standard shipping, carrier delivery estimates, tracking, and the costs shown before payment.", alternates: { canonical: "/shipping" } };

export default function ShippingPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Made-to-order timeline" title="From the press to your door" description="Standard shipping is included on every order. Production happens first; carrier transit starts after the piece clears production." />
      <dl className="border-t border-border/40">
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Order total</dt><dd className="text-sm leading-relaxed text-muted">The final item total, free standard shipping line, and estimated tax appear before Square processes payment. The checkout email becomes the order contact.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Production</dt><dd className="text-sm leading-relaxed text-muted">Most orders are printed, checked, and packed in <strong className="text-cream">{PRODUCTION_WINDOW}</strong>. This is separate from shipping time and may run longer during unusually high demand.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Transit</dt><dd className="text-sm leading-relaxed text-muted">Delivery is <strong className="text-cream">{DELIVERY_WINDOW}</strong>. Destination, carrier conditions, customs, weather, and address accuracy can affect the exact timing.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Tracking</dt><dd className="text-sm leading-relaxed text-muted">Tracking is sent to the checkout email after the carrier receives the package. You can also use the order number and checkout email on the <Link href="/track-order" className="text-accent underline underline-offset-4">Track Order page</Link>.</dd></div>
      </dl>
      <section className="mt-8 border-l-2 border-accent pl-4"><h2 className="font-display text-lg font-black uppercase">Address changes</h2><p className="mt-2 text-sm leading-relaxed text-muted">Contact support immediately with the order number and corrected address. Changes are not guaranteed after production or carrier processing begins.</p></section>
    </div></div>
  );
}
