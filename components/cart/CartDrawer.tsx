"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { formatCents } from "@/lib/utils/money";
import { SheepMark } from "@/components/ui/SheepMark";
import { TAX_LINE_COPY, getFulfillmentSummary, getShippingLineCopy } from "@/lib/commerce/policies";

export function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, totalFormatted, total } = useCart();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { toggleCart(); return; }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus(); };
  }, [isOpen, toggleCart]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button type="button" aria-label="Close shopping bag" className="cart-backdrop-enter absolute inset-0 h-full w-full cursor-default bg-void/80" onClick={toggleCart} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="bag-drawer-title" className="cart-panel-enter safe-top safe-bottom absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border/60 bg-void">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Shopping bag</p><h2 id="bag-drawer-title" className="mt-1 font-display text-2xl font-bold uppercase">Your bag</h2></div>
          <button type="button" onClick={toggleCart} className="min-h-11 border border-border/60 px-3 text-xs font-bold uppercase hover:border-accent">Close</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-start justify-center"><SheepMark className="mb-5 w-24 text-cream" /><h3 className="font-display text-2xl font-black uppercase">Nothing here yet</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">Items save in this browser until you remove them or complete checkout.</p><Link href="/shop" onClick={toggleCart} className="primary-action mt-6 min-h-11 px-5 py-3 text-xs">Open shop</Link></div>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((item) => (
                <li key={item.variationId} className="grid grid-cols-[5rem_1fr] gap-4 py-5">
                  <Link href={`/product/${item.slug || item.productId}`} onClick={toggleCart} className="relative aspect-square overflow-hidden border border-border/40 bg-surface">{item.image && <Image src={item.image} alt={item.name} fill className={isPrintfulImage(item.image) ? "object-contain" : "object-cover"} sizes="80px" />}</Link>
                  <div className="min-w-0"><Link href={`/product/${item.slug || item.productId}`} onClick={toggleCart} className="block truncate font-display text-base font-black uppercase hover:text-accent">{item.name}</Link><p className="mt-1 text-xs font-bold uppercase text-muted">{item.variationName}</p><p className="mt-1 font-mono text-xs font-bold">{formatCents(item.price * item.quantity)}</p><div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => updateQuantity(item.variationId, item.quantity - 1)} className="flex h-11 w-11 items-center justify-center border border-border/60 hover:border-accent" aria-label={`Decrease quantity of ${item.name}`}>&minus;</button><span className="w-6 text-center font-mono text-xs" aria-live="polite">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.variationId, item.quantity + 1)} className="flex h-11 w-11 items-center justify-center border border-border/60 hover:border-accent" aria-label={`Increase quantity of ${item.name}`}>+</button><button type="button" onClick={() => removeItem(item.variationId)} className="ml-auto min-h-11 text-xs font-bold uppercase text-muted underline underline-offset-4 hover:text-accent">Remove</button></div></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && <footer className="border-t border-border/40 px-5 py-5"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Subtotal</span><strong className="font-mono text-lg">{totalFormatted}</strong></div><p className="mt-3 text-xs leading-relaxed text-muted">Shipping: {getShippingLineCopy(total)}. Tax: {TAX_LINE_COPY}.</p><Link href="/cart" onClick={toggleCart} className="primary-action mt-5 flex min-h-12 w-full items-center justify-center px-5 py-3 text-sm">Review bag</Link><p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{getFulfillmentSummary()}</p></footer>}
      </div>
    </div>, document.body
  );
}
