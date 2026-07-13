import { PageHeader } from "@/components/ui/PageHeader";
import { RETURNS_SUMMARY, RETURNS_WINDOW } from "@/lib/commerce/policies";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";

export const metadata = { title: "Returns and Refund Review", description: "Read the After Hours Agenda return process, eligibility conditions, timing, and refund review terms for unworn made-to-order apparel before purchasing.", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="30-day return review" title="A clear way back" description={RETURNS_SUMMARY} />
      <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3">
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Start with the order</h2><p className="mt-3 text-sm leading-relaxed text-muted">Email {SUPPORT_EMAIL} within {RETURNS_WINDOW} of delivery. Include the order number, item, and reason for the request.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Keep it unworn</h2><p className="mt-3 text-sm leading-relaxed text-muted">Change-of-mind returns must be unworn, unwashed, and in original condition. Wait for return instructions before sending anything.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">We inspect, then resolve</h2><p className="mt-3 text-sm leading-relaxed text-muted">Eligible returns are inspected before refund approval. Original made-to-order production costs may be non-refundable once printing begins.</p></section>
      </div>
      <div className="mt-8 grid gap-6 border-y border-border/40 py-7 md:grid-cols-2"><section><h2 className="font-display text-lg font-black uppercase">Damage, misprints, or wrong items</h2><p className="mt-2 text-sm leading-relaxed text-muted">Send clear photos of the item and packaging with the order number. Confirmed production defects, transit damage, and incorrect items are reviewed separately from ordinary returns.</p></section><section><h2 className="font-display text-lg font-black uppercase">Need another size?</h2><p className="mt-2 text-sm leading-relaxed text-muted">Contact us before returning the item. Replacement availability depends on the active catalog and whether production has started.</p></section></div>
      <p className="mt-6 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Do not send card details by email. Approved refunds return through the original Square payment path; timing after approval depends on the payment provider and bank.</p>
    </div></div>
  );
}
