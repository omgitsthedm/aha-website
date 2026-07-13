import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW, RETURNS_SUMMARY } from "@/lib/commerce/policies";

export const metadata = { title: "FAQ", description: "Answers about After Hours Agenda orders, shipping, returns, fit, and care.", alternates: { canonical: "/faq" } };

const faqs = [
  { q: "When will my order arrive?", a: `Production usually takes ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}. These windows run one after the other, and tracking is sent when the package leaves production.` },
  { q: "Why are products made to order?", a: "After Hours Agenda begins production after payment. This reduces unused stock but means an item does not ship immediately." },
  { q: "What does shipping cost?", a: "Standard shipping is free. The checkout quote confirms the final shipping line and estimated tax before payment." },
  { q: "How do I choose a size?", a: "Use the fit note and size guide on the product page. Product-specific fit information takes priority over general guidance." },
  { q: "What payment methods can I use?", a: "Card payments are processed securely by Square. Apple Pay or Google Pay appears when Square supports the wallet on your device and browser." },
  { q: "How do I track an order?", a: "Use the order number and checkout email on the Track Order page. A tracking link appears after the carrier receives the shipment." },
  { q: "Can I cancel an order?", a: "Contact us as soon as possible. Because production can begin shortly after purchase, cancellation is not guaranteed once printing starts." },
  { q: "Can I change my shipping address?", a: "Contact us immediately with the order number and corrected address. We can only change it before the production or shipping partner locks the order." },
  { q: "What is the return policy?", a: RETURNS_SUMMARY },
  { q: "What if my item arrives damaged or misprinted?", a: "Email clear photos of the item, packaging, and order number. Confirmed production defects, damage, or incorrect items are handled separately from change-of-mind returns." },
  { q: "How do I care for a piece?", a: "Machine wash cold, inside out, and use low heat. Do not iron directly over the print." },
  { q: "Will the color match my screen exactly?", a: "Screens, garment batches, and print methods can shift color slightly. Product photography is a guide; product-specific descriptions and the garment label remain the practical source of truth." },
  { q: "Do you have customer reviews?", a: "After Hours Agenda does not publish an on-site review system yet. Ratings and testimonials will not be added without a real collection and moderation process." },
];

export default function FAQPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Order help / Straight answers" title="Before you email" description={<>Production, payment, fit, tracking, and returns are covered here. If your question is specific to an order, <Link href="/contact" className="text-accent underline underline-offset-4">contact support</Link>.</>} />
        <div className="border-t border-border/40">
          {faqs.map((faq) => <details key={faq.q} className="group border-b border-border/40"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-lg font-black uppercase leading-tight text-cream hover:text-accent"><span>{faq.q}</span><span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-sm leading-relaxed text-muted">{faq.a}</p></details>)}
        </div>
        <div className="mt-8 border-l-2 border-accent pl-4"><p className="text-sm leading-relaxed text-muted">Still stuck? Include your order number and checkout email when contacting support. Never send card details by email.</p></div>
      </div>
    </div>
  );
}
