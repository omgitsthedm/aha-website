"use client";

type CommerceEventName =
  | "view_item"
  | "select_variant"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "search"
  | "search_no_results"
  | "add_to_wishlist"
  | "remove_from_wishlist"
  | "view_size_guide"
  | "share";

export interface CommerceEvent {
  name: CommerceEventName;
  itemId?: string;
  variantId?: string;
  valueCents?: number;
  currency?: string;
  quantity?: number;
  resultCount?: number;
}

declare global {
  interface Window { dataLayer?: Array<Record<string, unknown>>; }
}

export function trackCommerceEvent(event: CommerceEvent): void {
  if (typeof window === "undefined") return;
  const detail = { ...event, path: window.location.pathname };
  window.dispatchEvent(new CustomEvent("aha:commerce", { detail }));
  window.dataLayer?.push({ event: `aha_${event.name}`, ...detail });
}
