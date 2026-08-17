import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Existing Order Returns",
  description: "Return and issue support for completed After Hours Agenda orders.",
  path: "/returns",
});

export default function ReturnsPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Existing-order support" title="Returns and issue review" description="The previous collection is archived. Requests for completed orders are still reviewed by support." />
      <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3">
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Start with the order</h2><p className="mt-3 text-sm leading-relaxed text-muted">Email {SUPPORT_EMAIL} with the order number, item, and reason for the request.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Include the details</h2><p className="mt-3 text-sm leading-relaxed text-muted">For damage, an incorrect item, or a quality issue, include clear photographs of the item and packaging when relevant.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">We review, then respond</h2><p className="mt-3 text-sm leading-relaxed text-muted">Each request is reviewed under the terms that applied when that order was placed. Wait for instructions before sending anything.</p></section>
      </div>
      <p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Do not send card details by email. Any approved refund follows the original payment path.</p>
    </div></div>
  );
}
