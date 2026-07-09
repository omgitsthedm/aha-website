import { RETURNS_SUMMARY, RETURNS_WINDOW } from "@/lib/commerce/policies";

export const metadata = {
  title: "Returns",
  description: "Return policy for After Hours Agenda orders.",
};

export default function ReturnsPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="misprint font-display text-[clamp(4rem,10vw,8rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] text-center mb-8">RETURNS</h1>
        <div className="space-y-6 font-body text-cream/80 leading-relaxed">
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">30-Day Return Policy</h2>
            <p className="font-bold">Not feeling it? No problem. We accept returns within <strong className="text-cream">{RETURNS_WINDOW}</strong> of delivery. Items must be unworn, unwashed, and in original condition with tags attached.</p>
            <p className="mt-3 font-bold">{RETURNS_SUMMARY}</p>
          </div>
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">How to Return</h2>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Email us at <span className="text-cream">hello@afterhoursagenda.com</span> with your order number</li>
              <li>We&apos;ll send you a return shipping label</li>
              <li>Ship the item back within 7 days</li>
              <li>Refund processed within 5-7 business days of receiving the item</li>
            </ol>
          </div>
          <div className="zine-block p-6">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-3">Exchanges</h2>
            <p className="font-bold">Wrong size? No stress. We&apos;ll swap it for free. Same process: email us and we&apos;ll take care of it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
