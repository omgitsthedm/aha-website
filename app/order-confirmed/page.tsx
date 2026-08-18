"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";
import { SheepMark } from "@/components/ui/SheepMark";
import { trackPurchase } from "@/lib/analytics/events";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW, RETURNS_WINDOW } from "@/lib/commerce/policies";
import { splitProductName } from "@/lib/utils/product-name";

interface OrderItem {
  name: string; variationName: string; quantity: number; lineTotal: number;
  productId?: string; slug?: string; variationId?: string; price?: number;
}

interface OrderSummary {
  orderNumber: string;
  receiptUrl: string | null;
  items: OrderItem[];
  subtotal?: number;
  discount?: number;
  total: number;
  currency: string;
  shippingName: string;
  shippingAddress: { address1: string; city: string; state: string; zip: string; country: string };
}

/**
 * The ending. Peak–end says this page and the receipt are what the customer
 * remembers, so it opens with thanks, shows the piece they bought, tells them
 * exactly what happens next, and closes warmly. Every fact on it (windows,
 * returns) comes from lib/commerce/policies so it agrees with the FAQ and the
 * email.
 */
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

  // The revenue event — the only place a purchase can be attributed client-side.
  // Runs once the summary is verified, and `trackPurchase` keys on the order
  // number so a refresh cannot double-count. Fire-and-forget by contract: the
  // order is already paid and queued for production regardless of what analytics
  // does here.
  useEffect(() => {
    if (!summary) return;
    trackPurchase({
      orderNumber: summary.orderNumber,
      totalCents: summary.total,
      currency: summary.currency,
      items: summary.items.map((item) => ({
        itemId: item.productId || item.slug || item.variationId || item.name,
        itemName: item.name,
        itemVariant: item.variationName,
        priceCents: item.price ?? Math.round(item.lineTotal / Math.max(1, item.quantity)),
        quantity: item.quantity,
      })),
    });
  }, [summary]);

  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
  const verified = Boolean(summary);
  const firstName = summary?.shippingName?.trim().split(/\s+/)[0] || "";
  const pieceCount = summary?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">{verified ? `Order ${summary!.orderNumber} · Payment complete` : loaded ? "Order lookup" : "Loading"}</p>
        <h1 className="editorial-title mt-5 text-[clamp(2.75rem,8vw,6rem)] text-cream">
          {verified ? <>Thank you{firstName ? `, ${firstName}` : ""}. <em>It’s being made for you.</em></> : loaded ? "We couldn’t find that order here" : "Loading order"}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          {summary
            ? `${pieceCount === 1 ? "Your piece is" : `Your ${pieceCount} pieces are`} entering production now — nothing was made until you asked for it, and nobody will be charged twice. A confirmation is on its way to your checkout email.`
            : loaded
              ? "This browser could not verify a matching completed order. Check the confirmation email before attempting payment again — your bag is untouched."
              : "Retrieving the order summary."}
        </p>
      </header>

      {summary && <>
        <section aria-labelledby="order-summary-title" className="mt-12 border-y border-border/40 py-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 id="order-summary-title" className="font-display text-2xl font-black uppercase tracking-[-0.03em] text-cream">What you ordered</h2>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted">Paid <span className="text-cream">{money(summary.total, summary.currency)}</span></p>
          </div>
          <ul className="mt-6 divide-y divide-border/40">
            {summary.items.map((item, index) => {
              const { name, garment } = splitProductName(item.name);
              return (
                <li key={`${item.name}-${item.variationName}-${index}`} className="flex items-center gap-5 py-4">
                  {item.slug ? (
                    <Link href={`/product/${item.slug}`} className="relative block h-24 w-20 shrink-0 overflow-hidden bg-surface">
                      <Image src={`/products/${item.slug}/front.jpg`} alt="" fill sizes="80px" className="object-cover" />
                    </Link>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-black uppercase tracking-[-0.02em] text-cream">{name}</p>
                    <p className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted">{[garment, item.variationName, `× ${item.quantity}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-cream">{money(item.lineTotal, summary.currency)}</span>
                </li>
              );
            })}
          </ul>
          {summary.discount && summary.discount > 0 ? (
            <div className="mt-4 space-y-1 border-t border-border/40 pt-4 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono">{money(summary.subtotal ?? summary.total + summary.discount, summary.currency)}</span></div>
              <div className="flex justify-between text-success"><span>Discount</span><span className="font-mono">-{money(summary.discount, summary.currency)}</span></div>
              <div className="flex justify-between font-bold text-cream"><span>Paid</span><span className="font-mono">{money(summary.total, summary.currency)}</span></div>
            </div>
          ) : null}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">Shipping to</p>
              <address className="mt-2 not-italic text-sm leading-relaxed text-cream">{summary.shippingName}<br />{summary.shippingAddress.address1}<br />{summary.shippingAddress.city}, {summary.shippingAddress.state} {summary.shippingAddress.zip}<br />{summary.shippingAddress.country}</address>
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">Receipt</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">Square sends the receipt to your checkout email.{summary.receiptUrl?.startsWith("https://") && <> <a href={summary.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline underline-offset-4">Open it now</a>.</>}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="next-title" className="mt-12">
          <h2 id="next-title" className="font-display text-2xl font-black uppercase tracking-[-0.03em] text-cream">What happens next</h2>
          <ol className="mt-5 border-t border-border/40">
            {[
              ["01", "It gets made", `Your order is in the production queue. Printing and a quality check take ${PRODUCTION_WINDOW}.`],
              ["02", "It ships, with tracking", `Delivery is ${DELIVERY_WINDOW}. You’ll get an email with tracking the moment it leaves.`],
              ["03", "You wear it — or they do", `If the size isn’t right, returns are on us for ${RETURNS_WINDOW}. Buying for someone else? Keep the order number handy; they can track it too.`],
            ].map(([n, title, body]) => (
              <li key={n} className="grid gap-2 border-b border-border/40 py-5 sm:grid-cols-[3rem_14rem_1fr] sm:gap-6">
                <span className="font-mono text-sm font-bold text-accent">{n}</span>
                <span className="font-display text-base font-black uppercase tracking-[-0.02em] text-cream">{title}</span>
                <p className="text-sm leading-relaxed text-muted md:text-base">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 grid gap-6 border-t border-border/40 pt-8 md:grid-cols-[auto_1fr] md:items-start">
          <SheepMark className="w-14 text-cream" title="The After Hours Agenda black sheep" />
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-accent">From all of us</p>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted md:text-lg">Made to order means made for you. Thank you for the work you do, and for spending some of what’s yours here — we hope this piece is around for the good days. Questions, any time: <a href="mailto:info@afterhoursagenda.com" className="font-bold text-accent underline underline-offset-4">info@afterhoursagenda.com</a>. A person reads every one.</p>
          </div>
        </section>
      </>}

      {!summary && loaded && <section className="mt-10 border border-border/40 bg-surface p-5"><h2 className="font-display text-xl font-black uppercase">Your bag is safe</h2><p className="mt-3 text-sm leading-relaxed text-muted">The bag was not cleared because this page could not verify a matching completed checkout. Check email or contact support before paying again.</p></section>}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/track-order" className="btn-primary px-6">Track this order</Link>
        {summary && <Link href="/shop" className="btn-secondary px-6">Find one for someone you love</Link>}
        {!summary && <Link href="/shipping" className="btn-secondary px-6">Shipping details</Link>}
      </div>
    </div></div>
  );
}
