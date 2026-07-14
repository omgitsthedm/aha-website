"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import type { Product } from "@/lib/utils/types";
import { extractVariationSize } from "@/lib/utils/variation";
import { trackCommerceEvent } from "@/lib/analytics/events";

interface QuickAddProps {
  product: Product;
  /**
   * Sizes (upper-cased) confirmed purchasable by the server-side enrichment
   * gate. When provided, only these sizes are offered — the same rule the
   * product page applies. Undefined means the product has no enrichment
   * record and all live Square variations are offered.
   */
  purchasableSizes?: string[];
}

export function QuickAdd({ product, purchasableSizes }: QuickAddProps) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const variations = product.variations.filter((v) => {
    if (!purchasableSizes) return true;
    return purchasableSizes.includes(extractVariationSize(v.name).toUpperCase());
  });

  if (variations.length === 0) return null;

  const add = (variationId: string) => {
    const variation = variations.find((v) => v.id === variationId);
    if (!variation) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      variationId: variation.id,
      name: product.name,
      variationName: variation.name,
      price: variation.price,
      priceFormatted: variation.priceFormatted,
      quantity: 1,
      image: product.images[0] || "",
    });
    trackCommerceEvent({ name: "add_to_cart", itemId: product.id, variantId: variation.id, valueCents: variation.price, currency: product.currency, quantity: 1 });
    setOpen(false);
    setAdded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div ref={rootRef} className="relative">
      {open && variations.length > 1 && (
        <div role="group" aria-label={`Choose a size for ${product.name}`} className="absolute bottom-full left-0 right-0 z-10 flex flex-wrap gap-1.5 border border-border/40 bg-surface p-2 shadow-lg">
          {variations.map((variation) => (
            <button
              key={variation.id}
              type="button"
              onClick={() => add(variation.id)}
              className="min-h-11 min-w-11 border border-border/60 px-2.5 text-xs font-bold text-cream transition-colors hover:border-accent hover:bg-rose"
            >
              {extractVariationSize(variation.name) || variation.name}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (variations.length === 1) {
            add(variations[0].id);
          } else {
            setOpen((prev) => !prev);
          }
        }}
        aria-expanded={variations.length > 1 ? open : undefined}
        aria-live="polite"
        className="min-h-11 w-full border border-border/60 bg-surface px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:border-accent hover:text-accent"
      >
        {added ? "Added to bag ✓" : variations.length === 1 ? "Add to bag" : open ? "Choose a size" : "Quick add"}
      </button>
    </div>
  );
}
