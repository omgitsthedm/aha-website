export const metadata = {
  title: "FAQ | After Hours Agenda",
  description: "Frequently asked questions about After Hours Agenda.",
};

const faqs = [
  { q: "How long does shipping take?", a: "Orders take 2-5 business days to produce, then 5-8 business days for US Standard shipping. Express options available at checkout." },
  { q: "Are your products made to order?", a: "Yes! Every piece is printed on demand using premium blanks. This means zero waste and each item is made specifically for you." },
  { q: "What's your return policy?", a: "We offer 30-day returns on unworn items in original condition. Free exchanges for size swaps." },
  { q: "Do you ship internationally?", a: "Yes, we ship worldwide. International shipping rates are calculated at checkout and typically take 8-16 business days." },
  { q: "What blanks do you use?", a: "We use premium Bella+Canvas, Gildan Heavy, and independent trading company blanks depending on the product. Each is selected for quality, fit, and durability." },
  { q: "How do I find my size?", a: "Check our Size Guide page for detailed measurements. When in doubt, most of our pieces run true to size. For an oversized fit, size up one." },
  { q: "Can I cancel my order?", a: "Since items are made to order, we can only cancel within 2 hours of placing your order. After that, production begins." },
  { q: "How do I care for my items?", a: "Machine wash cold, inside out, tumble dry low. Avoid ironing directly on prints. Check our Care Instructions page for details." },
];

export default function FAQPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-chapter text-center mb-8">FAQ</h1>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group bg-surface border border-border rounded-sm">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-display font-bold text-sm hover:text-gold transition-colors">
                {faq.q}
                <span className="text-muted group-open:rotate-45 transition-transform duration-200 text-lg">+</span>
              </summary>
              <div className="px-6 pb-6 font-body text-sm text-cream/70 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
