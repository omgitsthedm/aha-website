export const metadata = {
  title: "Shipping | After Hours Agenda",
  description: "Shipping information for After Hours Agenda orders.",
};

export default function ShippingPage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-chapter text-center mb-8">SHIPPING</h1>
        <div className="space-y-6 font-body text-cream/80 leading-relaxed">
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">Made to Order</h2>
            <p>Every After Hours Agenda piece is printed on demand, just for you. This means your order is crafted after you place it — no sitting in a warehouse, no mass production.</p>
          </div>
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">Processing Time</h2>
            <p>Orders typically take <strong className="text-cream">2-5 business days</strong> to print and prepare for shipment. During high-demand drops, this may extend to 5-7 business days.</p>
          </div>
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">Shipping Times</h2>
            <ul className="space-y-2 mt-2">
              <li className="flex justify-between"><span>US Standard</span><span className="font-mono text-sm text-muted">5-8 business days</span></li>
              <li className="flex justify-between"><span>US Express</span><span className="font-mono text-sm text-muted">2-4 business days</span></li>
              <li className="flex justify-between"><span>International</span><span className="font-mono text-sm text-muted">8-16 business days</span></li>
            </ul>
          </div>
          <div className="bg-surface border border-border rounded-sm p-6">
            <h2 className="font-display font-bold text-lg mb-3">Free Shipping</h2>
            <p>Orders over <strong className="text-gold">$75</strong> ship free within the US. International shipping rates are calculated at checkout.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
