"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { formatCents } from "@/lib/utils/money";
import { TAX_LINE_COPY, WALLET_CHECKOUT_COPY, getFulfillmentSummary, getShippingLineCopy } from "@/lib/commerce/policies";
import { PageHeader } from "@/components/ui/PageHeader";
import { trackCommerceEvent } from "@/lib/analytics/events";

export function CartPageContent() {
  const { items, removeItem, updateQuantity, totalFormatted, totalItems, total } = useCart();

  useEffect(() => {
    if (items.length > 0) trackCommerceEvent({ name: "view_cart", valueCents: total, currency: "USD", quantity: totalItems });
  }, [items.length, total, totalItems]);

  if (items.length === 0) {
    return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="0 items" title="Your bag" description="Your bag is empty. Items stay saved in this browser until you remove them or complete a verified checkout." /><Link href="/shop" className="primary-action inline-flex min-h-11 items-center px-5 py-3 text-xs">Start shopping</Link></div></div>;
  }

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`${totalItems} ${totalItems === 1 ? "item" : "items"}`} title="Your bag" description="Review sizes and quantities before moving to the secure Square payment step." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <ul className="border-t border-border/40" aria-label="Bag items">
          {items.map((item) => (
            <li key={item.variationId} className="grid grid-cols-[6rem_1fr] gap-4 border-b border-border/40 py-5 md:grid-cols-[8rem_1fr] md:gap-6">
              <Link href={`/product/${item.slug || item.productId}`} className="relative aspect-square overflow-hidden border border-border/40 bg-surface">
                {item.image && <Image src={item.image} alt={item.name} fill className={isPrintfulImage(item.image) ? "object-contain" : "object-cover"} sizes="128px" />}
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><Link href={`/product/${item.slug || item.productId}`} className="font-display text-lg font-black uppercase leading-tight hover:text-accent md:text-xl">{item.name}</Link><p className="mt-1 text-xs font-bold uppercase text-muted">{item.variationName}</p></div>
                  <p className="font-mono text-sm font-bold">{formatCents(item.price * item.quantity)}</p>
                </div>
                <p className="mt-2 text-xs text-muted">{formatCents(item.price)} each</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => updateQuantity(item.variationId, item.quantity - 1)} className="flex h-11 w-11 items-center justify-center border border-border/60 text-sm font-bold hover:border-accent" aria-label={`Decrease quantity of ${item.name}`}>&minus;</button>
                  <span className="w-8 text-center font-mono text-sm" aria-live="polite" aria-atomic="true">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.variationId, item.quantity + 1)} className="flex h-11 w-11 items-center justify-center border border-border/60 text-sm font-bold hover:border-accent" aria-label={`Increase quantity of ${item.name}`}>+</button>
                  <button type="button" onClick={() => removeItem(item.variationId)} className="ml-auto min-h-11 px-2 text-xs font-bold uppercase text-muted underline underline-offset-4 hover:text-accent">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside aria-labelledby="summary-heading" className="border-t-2 border-accent pt-5 lg:sticky lg:top-28 lg:self-start">
          <h2 id="summary-heading" className="font-display text-2xl font-black uppercase">Order summary</h2>
          <dl className="mt-5 space-y-4 border-y border-border/40 py-5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Subtotal</dt><dd className="font-mono font-bold">{totalFormatted}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Shipping</dt><dd className="max-w-[12rem] text-right text-xs">{getShippingLineCopy(total)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Tax</dt><dd className="max-w-[12rem] text-right text-xs">{TAX_LINE_COPY}</dd></div>
          </dl>
          <div className="flex items-center justify-between py-5"><span className="text-xs font-bold uppercase tracking-[0.08em]">Cart subtotal</span><strong className="font-mono text-lg">{totalFormatted}</strong></div>
          <Link href="/checkout" className="primary-action flex min-h-14 w-full items-center justify-center px-5 py-4 text-sm">Continue to checkout</Link>
          <p className="mt-4 text-xs leading-relaxed text-muted">{WALLET_CHECKOUT_COPY}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">{getFulfillmentSummary()}</p>
          <div className="mt-5 flex gap-4 text-xs font-bold uppercase tracking-[0.05em]"><Link href="/returns" className="text-accent underline underline-offset-4">Returns</Link><Link href="/shipping" className="text-accent underline underline-offset-4">Shipping</Link></div>
        </aside>
      </div>
    </div></div>
  );
}
