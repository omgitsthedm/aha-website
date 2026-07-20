"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ResilientImage } from "@/components/ui/ResilientImage";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { formatCents } from "@/lib/utils/money";
import { TAX_LINE_COPY, WALLET_CHECKOUT_COPY, getFulfillmentSummary, getShippingLineCopy } from "@/lib/commerce/policies";
import { PageHeader } from "@/components/ui/PageHeader";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { ExpressCheckout } from "@/components/checkout/ExpressCheckout";
import { SheepMark } from "@/components/ui/SheepMark";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";

interface RecItem { name: string; slug: string; priceFormatted: string; image: string }

// Automatic bundle offer (display only — the server enforces the real discount).
const BUNDLE_MIN = Number.parseInt(process.env.NEXT_PUBLIC_BUNDLE_MIN_QTY || "0", 10);
const BUNDLE_PCT = Number.parseInt(process.env.NEXT_PUBLIC_BUNDLE_PERCENT || "0", 10);

export function CartPageContent({ squareConfig }: { squareConfig: SquareWebPaymentsConfig }) {
  const { items, addItem, removeItem, updateQuantity, totalFormatted, totalItems, total } = useCart();
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [restored, setRestored] = useState(false);

  // Cross-device restore: a token-verified recovery link rebuilds the saved bag
  // here, on any device. Read-only fetch; merges into whatever's already in the bag.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recover") !== "1") return;
    const clean = () => window.history.replaceState({}, "", "/cart");
    const e = params.get("e");
    const t = params.get("t");
    if (!e || !t) { clean(); return; }
    const controller = new AbortController();
    fetch(`/api/checkout/restore?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Array<Record<string, unknown>> }) => {
        let added = 0;
        for (const l of Array.isArray(data?.items) ? data.items : []) {
          const variationId = typeof l.variationId === "string" ? l.variationId : "";
          const slug = typeof l.slug === "string" ? l.slug : "";
          if (!variationId || !slug) continue;
          const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
          addItem({
            productId: (typeof l.productId === "string" && l.productId) || slug,
            slug,
            variationId,
            name: String(l.title ?? ""),
            variationName: typeof l.size === "string" ? l.size : "",
            price: Number.isFinite(Number(l.price)) ? Number(l.price) : Math.round((Number(l.lineTotal) || 0) / quantity),
            priceFormatted: typeof l.priceFormatted === "string" ? l.priceFormatted : "",
            quantity,
            image: typeof l.image === "string" ? l.image : "",
          }, undefined, { silent: true });
          added += 1;
        }
        if (added > 0) setRestored(true);
        clean();
      })
      .catch(() => clean());
    return () => controller.abort();
  }, [addItem]);

  useEffect(() => {
    if (items.length > 0) trackCommerceEvent({ name: "view_cart", valueCents: total, currency: "USD", quantity: totalItems });
  }, [items.length, total, totalItems]);

  // "You may also like" — raises AOV the way Shopify's built-in recommendations
  // do. Reuses the cached search index; excludes what's already in the bag.
  useEffect(() => {
    if (items.length === 0) { setRecs([]); return; }
    const controller = new AbortController();
    fetch("/api/search-index", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((all: RecItem[]) => {
        const inCart = new Set(items.map((i) => i.slug || i.productId));
        setRecs(Array.isArray(all) ? all.filter((p) => p.slug && !inCart.has(p.slug)).slice(0, 4) : []);
      })
      .catch(() => { /* recs are optional — never block the cart */ });
    return () => controller.abort();
  }, [items]);

  if (items.length === 0) {
    return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl"><div className="mb-6 flex items-end gap-5"><SheepMark className="w-16 shrink-0 text-cream" title="The After Hours Agenda black sheep" /><PageHeader eyebrow="0 items" title="Your bag" description="Your bag is empty. Items stay saved in this browser until you remove them or complete a verified checkout." /></div><Link href="/shop" className="primary-action inline-flex min-h-11 items-center px-5 py-3 text-xs">Start shopping</Link></div></div>;
  }

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`${totalItems} ${totalItems === 1 ? "item" : "items"}`} title="Your bag" description="Review sizes and quantities before moving to the secure Square payment step." />
      {restored && <p role="status" className="mb-6 border border-accent/60 bg-surface px-4 py-3 text-sm font-bold text-cream">We brought your bag back — pick up right where you left off.</p>}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <ul className="border-t border-border/40" aria-label="Bag items">
          {items.map((item) => (
            <li key={item.variationId} className="grid grid-cols-[6rem_1fr] gap-4 border-b border-border/40 py-5 md:grid-cols-[8rem_1fr] md:gap-6">
              <Link href={`/product/${item.slug || item.productId}`} className="relative aspect-square overflow-hidden border border-border/40 bg-surface">
                {item.image && <ResilientImage src={item.image} alt={item.name} fill className={isPrintfulImage(item.image) ? "object-contain" : "object-cover"} sizes="128px" />}
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
          {/* Funnel-wide aspirational moment: picture wearing it while you review the bag. */}
          <div className="relative mb-6 aspect-[16/10] overflow-hidden">
            <Image src="/campaign/lifestyle/women.webp" alt="After Hours Agenda, worn in New York" fill className="object-cover object-top" sizes="(max-width: 1024px) 100vw, 22rem" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF8DA1]">Build your fit</p>
              <p className="mt-1 font-display text-lg font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">Made after hours. Worn all day.</p>
            </div>
          </div>
          <h2 id="summary-heading" className="font-display text-2xl font-black uppercase">Order summary</h2>
          <dl className="mt-5 space-y-4 border-y border-border/40 py-5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Subtotal</dt><dd className="font-mono font-bold">{totalFormatted}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Shipping</dt><dd className="max-w-[12rem] text-right text-xs">{getShippingLineCopy(total)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Tax</dt><dd className="max-w-[12rem] text-right text-xs">{TAX_LINE_COPY}</dd></div>
          </dl>
          {(() => {
            const bundleActive = BUNDLE_MIN >= 2 && BUNDLE_PCT > 0 && totalItems >= BUNDLE_MIN;
            // Display-only estimate; the server resolves the real (better-of) discount at checkout.
            const bundleDiscount = bundleActive ? Math.round((total * BUNDLE_PCT) / 100) : 0;
            return (
              <>
                {bundleActive && (
                  <div className="flex items-center justify-between py-2 text-sm text-success">
                    <span className="font-bold uppercase tracking-[0.06em]">Bundle discount ({BUNDLE_PCT}%)</span>
                    <strong className="font-mono">−{formatCents(bundleDiscount)}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between py-5">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]">{bundleActive ? "Estimated total" : "Cart subtotal"}</span>
                  <strong className="font-mono text-lg">{bundleActive ? formatCents(total - bundleDiscount) : totalFormatted}</strong>
                </div>
                {BUNDLE_MIN >= 2 && BUNDLE_PCT > 0 && (
                  bundleActive
                    ? <p className="mb-4 border border-success/50 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-success">Bundle unlocked — {BUNDLE_PCT}% off, applied at checkout. Final total confirmed at payment.</p>
                    : <p className="mb-4 border border-border/40 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-muted">Add {BUNDLE_MIN - totalItems} more to save {BUNDLE_PCT}%.</p>
                )}
              </>
            );
          })()}
          <ExpressCheckout squareConfig={squareConfig} />
          <Link href="/checkout" className="primary-action flex min-h-14 w-full items-center justify-center px-5 py-4 text-sm">Continue to checkout</Link>
          <p className="mt-4 text-xs leading-relaxed text-muted">{WALLET_CHECKOUT_COPY}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">{getFulfillmentSummary()}</p>
          <div className="mt-5 flex gap-4 text-xs font-bold uppercase tracking-[0.05em]"><Link href="/returns" className="text-accent underline underline-offset-4">Returns</Link><Link href="/shipping" className="text-accent underline underline-offset-4">Shipping</Link></div>
        </aside>
      </div>

      {recs.length > 0 && (
        <section aria-labelledby="cart-recs" className="mt-16 border-t border-border/40 pt-10">
          <h2 id="cart-recs" className="mb-6 font-display text-[clamp(1.5rem,4vw,2.5rem)] font-black uppercase leading-none tracking-[-0.04em]">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-5">
            {recs.map((p) => (
              <Link key={p.slug} href={`/product/${p.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
                  {p.image && <ResilientImage src={p.image} alt={p.name} fill className={`${isPrintfulImage(p.image) ? "object-contain" : "object-cover"} transition-transform duration-300 group-hover:scale-[1.02]`} sizes="(max-width: 768px) 50vw, 25vw" />}
                </div>
                <h3 className="mt-3 font-display text-sm font-black uppercase leading-tight group-hover:text-accent">{p.name}</h3>
                <p className="mt-1 text-xs font-bold text-muted">{p.priceFormatted}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div></div>
  );
}
