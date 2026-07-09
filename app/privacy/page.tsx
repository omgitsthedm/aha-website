export const metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for After Hours Agenda.",
};

export default function PrivacyPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="misprint font-display text-[clamp(3.5rem,9vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] text-center mb-8">PRIVACY POLICY</h1>
        <div className="zine-block space-y-6 p-6 font-body text-cream/80 leading-relaxed text-sm md:p-8">
          <p>Last updated: February 2026</p>
          <p>After Hours Agenda (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy. This policy explains how we collect, use, and protect your information when you use our website.</p>
          <h2 className="font-display font-bold text-base text-cream !mt-8">Information We Collect</h2>
          <p>We collect information you provide directly: name, email, shipping address, and payment information. Payments are processed securely through Square. We never store card details.</p>
          <h2 className="font-display font-bold text-base text-cream !mt-8">How We Use It</h2>
          <p>To process and ship your orders, send order confirmations and shipping updates, respond to your questions, and improve our website and products.</p>
          <h2 className="font-display font-bold text-base text-cream !mt-8">We Never Sell Your Data</h2>
          <p>Your information is never sold or rented to third parties. Period. We share information only with service providers necessary to fulfill your order (Square for payments, Printful for production and shipping).</p>
          <h2 className="font-display font-bold text-base text-cream !mt-8">Contact</h2>
          <p>Questions about your data? Email us at <span className="text-cream">hello@afterhoursagenda.com</span>.</p>
        </div>
      </div>
    </div>
  );
}
