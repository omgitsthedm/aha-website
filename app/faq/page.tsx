import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Existing Order Help",
  description: "Support for completed After Hours Agenda orders while the next collection is in development.",
  path: "/faq",
});

const faqs = [
  ["Is anything available to order?", "No. The previous collection is archived and checkout is unavailable while the next release is prepared."],
  ["How do I track a completed order?", "Use the order number and checkout email on the Track Order page. If a carrier link is available, it appears once the shipment is in transit."],
  ["Can I update an address or cancel a completed order?", "Contact support as soon as possible with the order number and corrected details. We will confirm what can still be changed for that order."],
  ["How do returns or damaged-item requests work?", "Contact support with the order number, a clear description of the issue, and photographs when relevant. Requests are reviewed under the terms that applied when the order was placed."],
  ["How should I care for an item from the prior collection?", "Follow the garment label first. General care guidance remains available on the Care page."],
] as const;

export default function FAQPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Order help" title="Support for completed orders" description={<>The previous collection is archived. If your question is about an order you already placed, <Link href="/contact" className="text-accent underline underline-offset-4">contact support</Link> with the order number and checkout email.</>} />
      <div className="border-t border-border/40">{faqs.map(([question, answer]) => <details key={question} className="group border-b border-border/40"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-lg font-black uppercase leading-tight text-cream hover:text-accent"><span>{question}</span><span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-sm leading-relaxed text-muted">{answer}</p></details>)}</div>
      <p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Never send card details by email.</p>
    </div></div>
  );
}
