"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import type { CartItem } from "@/lib/utils/types";

/**
 * Seeds the bag from a Meta (Facebook/Instagram Shop) checkout hand-off —
 * /checkout?products=SKU:QTY,… resolved server-side into real cart lines.
 * Replaces the saved bag once browser storage has hydrated (the shopper's Meta
 * cart IS the order), then cleans the URL so a refresh doesn't reseed the bag
 * after they edit it. Renders nothing.
 */
export function MetaCheckoutPrefill({ items }: { items: CartItem[] }) {
  const { hydrated, clearCart, addItem } = useCart();
  const seeded = useRef(false);

  useEffect(() => {
    if (!hydrated || seeded.current || items.length === 0) return;
    seeded.current = true;
    clearCart();
    for (const item of items) {
      addItem(item, undefined, { silent: true });
    }
    window.history.replaceState({}, "", "/checkout");
  }, [hydrated, items, clearCart, addItem]);

  return null;
}
