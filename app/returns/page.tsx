export const metadata = {
  title: "Returns | After Hours Agenda",
  description: "Return policy for After Hours Agenda orders.",
};

export default function ReturnsPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-chapter text-center mb-8">RETURNS</h1>
        <div className="space-y-6 font-body text-cream/80 leading-relaxed">
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">30-Day Return Policy</h2>
            <p>Not feeling it? No problem. We accept returns within <strong className="text-cream">30 days</strong> of delivery. Items must be unworn, unwashed, and in original condition with tags attached.</p>
          </div>
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">How to Return</h2>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Email us at <span className="text-gold">hello@afterhoursagenda.com</span> with your order number</li>
              <li>We'll send you a return shipping label</li>
              <li>Ship the item back within 7 days</li>
              <li>Refund processed within 5-7 business days of receiving the item</li>
            </ol>
          </div>
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">Exchanges</h2>
            <p>Need a different size? We offer free exchanges for size swaps. Same process — email us and we'll take care of it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
