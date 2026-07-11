"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { CartItem, Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface AddToCartModalProps { isOpen: boolean; onClose: () => void; onViewBag: () => void; addedItem: CartItem | null; relatedProducts: Product[]; }

export function AddToCartModal({ isOpen, onClose, onViewBag, addedItem, relatedProducts }: AddToCartModalProps) {
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
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus(); };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || !addedItem) return null;
  const suggested = relatedProducts.slice(0, 3);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button type="button" aria-label="Close added item dialog" className="absolute inset-0 h-full w-full cursor-default bg-void/80" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="added-title" className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto border border-border/60 bg-void">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Bag updated</p><h2 id="added-title" className="mt-1 font-display text-2xl font-black uppercase">Added to bag</h2></div><button type="button" onClick={onClose} className="min-h-11 border border-border/60 px-3 text-xs font-bold uppercase hover:border-accent">Close</button></header>
        <div className="grid grid-cols-[4rem_1fr] gap-4 p-5">{addedItem.image && <div className="relative aspect-square overflow-hidden border border-border/40 bg-surface"><Image src={addedItem.image} alt={addedItem.name} fill className={isPrintfulImage(addedItem.image) ? "object-contain" : "object-cover"} sizes="64px" /></div>}<div className="min-w-0"><h3 className="truncate font-display text-lg font-black uppercase">{addedItem.name}</h3><p className="mt-1 text-xs font-bold uppercase text-muted">{addedItem.variationName}</p><p className="mt-1 font-mono text-sm font-bold">{addedItem.priceFormatted}</p></div></div>
        {suggested.length > 0 && <section className="border-t border-border/40 p-5"><h3 className="font-display text-xl font-black uppercase">Related pieces</h3><div className="mt-4 grid grid-cols-3 gap-3">{suggested.map((product) => { const image = product.images[0]; return <Link key={product.id} href={`/product/${product.slug}`} onClick={onClose} className="group block"><div className="relative aspect-[3/4] overflow-hidden border border-border/40 bg-surface">{image && <Image src={image} alt={product.name} fill className={isPrintfulImage(image) ? "object-contain" : "object-cover"} sizes="160px" />}</div><h4 className="mt-2 line-clamp-2 text-[10px] font-bold uppercase leading-tight">{product.name}</h4><p className="mt-1 font-mono text-[10px] text-muted">{product.priceFormatted}</p></Link>; })}</div></section>}
        <footer className="grid gap-3 border-t border-border/40 p-5 sm:grid-cols-2"><button type="button" onClick={onClose} className="min-h-12 border border-border/60 px-5 py-3 text-xs font-bold uppercase hover:border-accent">Keep shopping</button><button type="button" onClick={onViewBag} className="primary-action min-h-12 px-5 py-3 text-xs">Review bag</button></footer>
      </div>
    </div>, document.body
  );
}
