"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW } from "@/lib/commerce/policies";

interface OrderSummary {
  orderNumber: string;
  receiptUrl: string | null;
  items: Array<{ name: string; variationName: string; quantity: number; lineTotal: number }>;
  subtotal?: number;
  discount?: number;
  total: number;
  currency: string;
  shippingName: string;
  shippingAddress: { address1: string; city: string; state: string; zip: string; country: string };
}

export default function OrderConfirmedPage() {
  const { clearCart } = useCart();
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const orderNumber = new URLSearchParams(window.location.search).get("order");
    const saved = sessionStorage.getItem("aha-last-order");
    if (orderNumber && saved) {
      try {
        const parsed = JSON.parse(saved) as OrderSummary;
        if (parsed.orderNumber === orderNumber) { setSummary(parsed); clearCart(); }
      } catch { sessionStorage.removeItem("aha-last-order"); }
    }
    setLoaded(true);
  }, [clearCart]);

  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
  const verified = Boolean(summary);

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <header className="border-t-2 border-accent pt-5"><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent">{verified ? "Payment complete" : loaded ? "Order lookup" : "Loading"}</p><h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,6rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">{verified ? "Order confirmed" : loaded ? "Details unavailable" : "Loading order"}</h1><p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">{summary ? `Order ${summary.orderNumber} was received. Confirmation was sent to the checkout email.` : loaded ? "This browser could not verify a matching completed order. Check the confirmation email before attempting payment again." : "Retrieving the order summary."}</p></header>

      {summary && <>
        <section aria-labelledby="order-summary-title" className="mt-10 border-y border-border/40 py-7">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Status</p><h2 id="order-summary-title" className="mt-1 font-display text-2xl font-black uppercase text-success">Order received</h2></div><div className="text-right"><p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Amount paid</p><p className="mt-1 font-mono text-xl font-bold">{money(summary.total, summary.currency)}</p></div></div>
          <div className="mt-7 grid gap-8 md:grid-cols-2">
            <div><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Items</h3><ul className="mt-3 divide-y divide-border/40">{summary.items.map((item, index) => <li key={`${item.name}-${item.variationName}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.name}<span className="block text-xs text-muted">{item.variationName} x {item.quantity}</span></span><span className="font-mono font-bold">{money(item.lineTotal, summary.currency)}</span></li>)}</ul>{summary.discount && summary.discount > 0 ? <div className="mt-3 space-y-1 border-t border-border/40 pt-3 text-sm"><div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono">{money(summary.subtotal ?? summary.total + summary.discount, summary.currency)}</span></div><div className="flex justify-between text-success"><span>Discount</span><span className="font-mono">-{money(summary.discount, summary.currency)}</span></div><div className="flex justify-between font-bold text-cream"><span>Paid</span><span className="font-mono">{money(summary.total, summary.currency)}</span></div></div> : null}</div>
            <div><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Shipping to</h3><address className="mt-3 not-italic text-sm leading-relaxed text-cream">{summary.shippingName}<br />{summary.shippingAddress.address1}<br />{summary.shippingAddress.city}, {summary.shippingAddress.state} {summary.shippingAddress.zip}<br />{summary.shippingAddress.country}</address></div>
          </div>
        </section>

        <section aria-labelledby="next-title" className="mt-10"><h2 id="next-title" className="font-display text-2xl font-black uppercase">What happens next</h2><ol className="mt-5 border-t border-border/40"><li className="grid gap-3 border-b border-border/40 py-5 sm:grid-cols-[3rem_1fr]"><span className="font-mono text-accent">01</span><p className="text-sm leading-relaxed text-muted">Payment is confirmed and the order enters the production queue.</p></li><li className="grid gap-3 border-b border-border/40 py-5 sm:grid-cols-[3rem_1fr]"><span className="font-mono text-accent">02</span><p className="text-sm leading-relaxed text-muted">Printing and quality checks usually take {PRODUCTION_WINDOW}.</p></li><li className="grid gap-3 border-b border-border/40 py-5 sm:grid-cols-[3rem_1fr]"><span className="font-mono text-accent">03</span><p className="text-sm leading-relaxed text-muted">Delivery is {DELIVERY_WINDOW}. Tracking is sent by email after shipment.</p></li></ol></section>

        <section className="mt-8 border-l-2 border-accent pl-4"><h2 className="font-display text-lg font-black uppercase">Receipt and support</h2><p className="mt-2 text-sm leading-relaxed text-muted">Square sends the receipt to the checkout email.{summary.receiptUrl?.startsWith("https://") && <> <a href={summary.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">Open this receipt</a>.</>} If it does not arrive, email <a href="mailto:info@afterhoursagenda.com" className="text-accent underline underline-offset-4">info@afterhoursagenda.com</a>.</p></section>
      </>}

      {!summary && loaded && <section className="mt-10 border border-border/40 bg-surface p-5"><h2 className="font-display text-xl font-black uppercase">Your bag is safe</h2><p className="mt-3 text-sm leading-relaxed text-muted">The bag was not cleared because this page could not verify a matching completed checkout. Check email or contact support before paying again.</p></section>}

      <div className="mt-10 flex flex-wrap gap-3"><Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Continue shopping</Link><Link href="/shipping" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Shipping details</Link></div>
    </div></div>
  );
}
