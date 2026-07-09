import {
  DELIVERY_WINDOW,
  FREE_SHIPPING_THRESHOLD_CENTS,
  PRODUCTION_WINDOW,
} from "@/lib/commerce/policies";
import { formatCents } from "@/lib/utils/money";

export const metadata = {
  title: "Shipping | After Hours Agenda",
  description: "Shipping information for After Hours Agenda orders.",
};

export default function ShippingPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="misprint font-display text-[clamp(4rem,10vw,8rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] text-center mb-8">SHIPPING</h1>
        <div className="space-y-6 font-body text-cream/80 leading-relaxed">
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Made to Order</h2>
            <p className="font-bold">Every piece is crafted after you order it. No warehouses, no sitting on shelves, just freshly made gear shipped straight to you.</p>
          </div>
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Processing Time</h2>
            <p className="font-bold">Orders typically take <strong className="text-cream">{PRODUCTION_WINDOW}</strong> to print and prepare for shipment. During high-demand drops, this may extend to 5-7 business days.</p>
          </div>
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Shipping Times</h2>
            <p className="mb-4 font-bold">
              Most deliveries arrive {DELIVERY_WINDOW}. Exact shipping methods
              and rates are confirmed before payment in Square.
            </p>
            <ul className="space-y-2 mt-2">
              <li className="flex justify-between"><span>US Standard</span><span className="font-mono text-sm text-muted">5-8 business days</span></li>
              <li className="flex justify-between"><span>US Express</span><span className="font-mono text-sm text-muted">2-4 business days</span></li>
              <li className="flex justify-between"><span>International</span><span className="font-mono text-sm text-muted">8-16 business days</span></li>
            </ul>
          </div>
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Free Shipping</h2>
            <p className="font-bold">Orders over <strong className="text-cream">{formatCents(FREE_SHIPPING_THRESHOLD_CENTS)}</strong> ship free within the US. International shipping rates are calculated at checkout.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
