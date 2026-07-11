import { PageHeader } from "@/components/ui/PageHeader";
import { RETURNS_SUMMARY, RETURNS_WINDOW } from "@/lib/commerce/policies";

export const metadata = { title: "Returns", description: "Return policy for After Hours Agenda orders.", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Policy" title="Returns" description={RETURNS_SUMMARY} />
      <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3">
        <section className="bg-void p-6"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">01 / Contact</p><h2 className="mt-3 font-display text-xl font-black uppercase">Start by email</h2><p className="mt-3 text-sm leading-relaxed text-muted">Email hello@afterhoursagenda.com within {RETURNS_WINDOW} of delivery. Include the order number and reason for return.</p></section>
        <section className="bg-void p-6"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">02 / Review</p><h2 className="mt-3 font-display text-xl font-black uppercase">Keep it unworn</h2><p className="mt-3 text-sm leading-relaxed text-muted">The item must be unworn, unwashed, and returned in its original condition. We will confirm instructions by email.</p></section>
        <section className="bg-void p-6"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">03 / Resolution</p><h2 className="mt-3 font-display text-xl font-black uppercase">Refund review</h2><p className="mt-3 text-sm leading-relaxed text-muted">Returned items are inspected before a refund is approved. Made-to-order production fees may be non-refundable after printing begins.</p></section>
      </div>
      <p className="mt-6 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Need a different size? Contact us before returning the item. Replacement availability depends on the active catalog and production status.</p>
    </div></div>
  );
}
