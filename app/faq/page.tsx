export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about After Hours Agenda.",
};

const faqs = [
  { q: "How long does shipping take?", a: "Orders take 2-5 business days to produce, then 5-8 business days for US Standard shipping. Express options available at checkout." },
  { q: "Are your products made to order?", a: "Every piece is made just for you, printed on premium blanks, and shipped directly to your door. No overproduction, no waste." },
  { q: "What's your return policy?", a: "We offer easy 30-day returns on unworn items in original condition. Need a different size? Exchanges are free." },
  { q: "Do you ship internationally?", a: "Yes, we ship worldwide. International shipping rates are calculated at checkout and typically take 8-16 business days." },
  { q: "What blanks do you use?", a: "We use premium Bella+Canvas, Gildan Heavy, and independent trading company blanks depending on the product. Each is selected for quality, fit, and durability." },
  { q: "How do I find my size?", a: "Check our Size Guide page for detailed measurements. Our pieces run true to size. Want that oversized look? Go up one." },
  { q: "Can I cancel my order?", a: "Since items are made to order, we can only cancel within 2 hours of placing your order. After that, production begins." },
  { q: "How do I care for my items?", a: "Machine wash cold, inside out, tumble dry low. Avoid ironing directly on prints. Check our Care Instructions page for details." },
];

export default function FAQPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="misprint font-display text-[clamp(4rem,10vw,8rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] text-center mb-8">FAQ</h1>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group zine-block">
              <summary className="flex cursor-pointer items-center justify-between p-6 font-display text-xl font-black uppercase leading-none tracking-[-0.04em] transition-colors hover:text-[#CCFF00]">
                {faq.q}
                <span className="text-muted group-open:rotate-45 transition-transform duration-200 text-lg">+</span>
              </summary>
              <div className="px-6 pb-6 font-body text-sm font-bold text-cream/80 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
