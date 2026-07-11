import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW, RETURNS_SUMMARY } from "@/lib/commerce/policies";

export const metadata = { title: "FAQ", description: "Answers about After Hours Agenda orders, shipping, returns, fit, and care.", alternates: { canonical: "/faq" } };

const faqs = [
  { q: "When will my order arrive?", a: `Production usually takes ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}. Tracking is sent when the order ships.` },
  { q: "Are products made to order?", a: "Yes. Production starts after the order is placed, so an item may not ship immediately." },
  { q: "What is the return policy?", a: RETURNS_SUMMARY },
  { q: "What does shipping cost?", a: "Standard shipping is free. The checkout quote confirms the final shipping line and estimated tax before payment." },
  { q: "How do I choose a size?", a: "Use the fit note and size guide on the product page. Product-specific fit information takes priority over general guidance." },
  { q: "Can I cancel an order?", a: "Contact us as soon as possible. Because production can begin shortly after purchase, cancellation is not guaranteed once printing starts." },
  { q: "How do I care for a piece?", a: "Machine wash cold, inside out, and use low heat. Do not iron directly over the print." },
];

export default function FAQPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Order help" title="Questions, answered" description={<>Start here. If your question is specific to an order, <Link href="/contact" className="text-accent underline underline-offset-4">contact us</Link>.</>} />
        <div className="border-t border-border/40">
          {faqs.map((faq) => <details key={faq.q} className="group border-b border-border/40"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-lg font-black uppercase leading-tight text-cream hover:text-accent"><span>{faq.q}</span><span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-sm leading-relaxed text-muted">{faq.a}</p></details>)}
        </div>
      </div>
    </div>
  );
}
