import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Shipping Update",
  description: "Shipping support for completed After Hours Agenda orders while the next collection is in development.",
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Existing-order support" title="Shipping information" description="The prior collection is archived. This page supports orders already placed; new orders are unavailable." />
      <dl className="border-t border-border/40">
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Tracking</dt><dd className="text-sm leading-relaxed text-muted">Use the order number and checkout email on the <Link href="/track-order" className="text-accent underline underline-offset-4">Track Order page</Link>. A tracking link appears once it is available for that shipment.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Address changes</dt><dd className="text-sm leading-relaxed text-muted">Contact support with the order number and corrected address. We will confirm whether a change remains possible for that completed order.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Delivery questions</dt><dd className="text-sm leading-relaxed text-muted">Carrier conditions and destination details can affect delivery. Contact support with the order number for help with a specific shipment.</dd></div>
      </dl>
    </div></div>
  );
}
