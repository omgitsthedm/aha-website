import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW, RETURNS_WINDOW, SHIPPING_CLAIM_SENTENCE } from "@/lib/commerce/policies";

export const metadata = buildMetadata({
  title: "FAQ",
  description: "How After Hours Agenda orders work: made to order, shipping, returns, tracking, care — answered by a person.",
  path: "/faq",
});

const faqs = [
  ["How does ordering work?", `Every piece is made to order. Production takes ${PRODUCTION_WINDOW}; delivery is ${DELIVERY_WINDOW}. ${SHIPPING_CLAIM_SENTENCE}`],
  ["Can I return something?", `Unworn items can be returned within ${RETURNS_WINDOW}, and we cover return shipping. Made-to-order production fees may be non-refundable once printing starts.`],
  ["How do I track an order?", "Use the order number and checkout email on the Track Order page. If a carrier link is available, it appears once the shipment is in transit."],
  ["Can I update an address or cancel an order?", "Contact support as soon as possible with the order number and corrected details. Because each piece is printed to order, changes are only possible before production starts."],
  ["How do returns or damaged-item requests work?", "Contact support with the order number, a clear description of the issue, and photographs when relevant. Requests are reviewed under the terms that applied when the order was placed."],
  ["How should I care for my piece?", "Machine wash cold inside out, tumble dry low. Follow the garment label first; the Care page has the full guidance."],
  ["Buying it as a gift?", `Most people are. Returns are on us within ${RETURNS_WINDOW}, so buy the size you think and we’ll sort the rest. The size guide lists exact garment measurements if you want to check a favorite piece first.`],
] as const;

// FAQPage structured data — the same strings the page renders, so the rich
// result can never say something the page does not. JSON.stringify escapes.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function FAQPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHeader eyebrow="Order help" title="Questions, answered" description={<>Everything is made to order and shipped with tracking, and every question is answered by a person. If it’s about an order you already placed, <Link href="/contact" className="text-accent underline underline-offset-4">write to us</Link> with the order number and checkout email.</>} />
      <div className="border-t border-border/40">{faqs.map(([question, answer]) => <details key={question} className="group border-b border-border/40"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-lg font-black uppercase leading-tight text-cream hover:text-accent"><span>{question}</span><span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-sm leading-relaxed text-muted">{answer}</p></details>)}</div>
      <p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Never send card details by email.</p>
    </div></div>
  );
}
