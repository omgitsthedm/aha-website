import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { RETURNS_WINDOW } from "@/lib/commerce/policies";

export const metadata = buildMetadata({
  title: "Returns",
  description: "After Hours Agenda returns: unworn items within 30 days, return shipping on us.",
  path: "/returns",
});

export default function ReturnsPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Returns" title="Returns, made easy" description={`Unworn items can be returned within ${RETURNS_WINDOW}, and we cover return shipping. Made-to-order production fees may be non-refundable once printing starts.`} />
      <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3">
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Start with the order</h2><p className="mt-3 text-sm leading-relaxed text-muted">Email {SUPPORT_EMAIL} with the order number, item, and reason for the request.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Include the details</h2><p className="mt-3 text-sm leading-relaxed text-muted">For damage, an incorrect item, or a quality issue, include clear photographs of the item and packaging when relevant.</p></section>
        <section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">We review, then respond</h2><p className="mt-3 text-sm leading-relaxed text-muted">Each request is reviewed under the terms that applied when that order was placed. Wait for the prepaid label and instructions before sending anything.</p></section>
      </div>
      <p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Do not send card details by email. Any approved refund follows the original payment path.</p>
    </div></div>
  );
}
