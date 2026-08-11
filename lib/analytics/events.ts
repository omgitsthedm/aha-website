"use client";

import { getConsent } from "@/lib/consent/consent";
import { isCanonicalAnalyticsHost } from "@/lib/analytics/host";

type CommerceEventName =
  | "view_item"
  | "select_variant"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  | "search_no_results"
  | "add_to_wishlist"
  | "remove_from_wishlist"
  | "view_size_guide"
  | "share";

/** One line of a GA4 `items[]` array, kept in the repo's cents money units. */
export interface CommerceEventItem {
  itemId: string;
  itemName?: string;
  itemVariant?: string;
  /** Unit price in cents — not the line total. */
  priceCents?: number;
  quantity?: number;
}

export interface CommerceEvent {
  name: CommerceEventName;
  itemId?: string;
  itemName?: string;
  itemVariant?: string;
  variantId?: string;
  valueCents?: number;
  currency?: string;
  quantity?: number;
  resultCount?: number;
  /** Order number for `purchase`. Doubles as the Meta de-duplication key. */
  transactionId?: string;
  /** Full basket. When omitted, one line is inferred from `itemId`. */
  items?: CommerceEventItem[];
}

export interface PurchaseEvent {
  orderNumber: string;
  totalCents: number;
  currency: string;
  items: CommerceEventItem[];
}

type TagParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: string, ...args: unknown[]) => void;
    fbq?: (command: string, name: string, params?: TagParams, options?: { eventID?: string }) => void;
  }
}

// Consent is read through `getConsent()` from lib/consent/consent.ts rather
// than the `useConsent` hook, because this module is called from plain event
// handlers and mount effects, not from React render. It previously re-declared
// the storage key literal, which meant renaming the key in one file would have
// made this gate fail closed — every event silently dropped, no error.

/**
 * Production runs bare gtag.js, so events are sent with `gtag('event', ...)`
 * and real GA4 ecommerce parameter names. A GTM container remains supported —
 * when one is configured we push the historic `aha_*` objects instead — but we
 * NEVER create `window.dataLayer` ourselves: GTM drains whatever it finds at
 * load, which would retroactively transmit everything a shopper did before
 * granting consent.
 */
const GTM_CONTAINER = process.env.NEXT_PUBLIC_GTM_ID?.trim();

type Destination = "google" | "meta";

interface QueuedEvent {
  destination: Destination;
  name: string;
  params: TagParams;
  /** Meta de-duplication id, so a later CAPI send collapses onto this one. */
  eventId?: string;
  /** GTM-convention payload, used only when a container is configured. */
  legacy?: Record<string, unknown>;
}

// Tags load with `afterInteractive`, so mount-time events (PDP `view_item`,
// `/cart` `view_cart`) routinely fire before the tag exists. They wait here
// instead of being dropped, and are abandoned rather than leaked if the tag
// never answers — an ad blocker must not grow this array forever.
const MAX_QUEUED = 30;
const RETRY_MS = 400;
const MAX_RETRIES = 25; // ~10s, enough for a slow mobile connection
const queue: QueuedEvent[] = [];
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function consentGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return getConsent() === "granted";
  } catch {
    return false;
  }
}

function deliver(queued: QueuedEvent): boolean {
  if (queued.destination === "meta") {
    if (typeof window.fbq !== "function") return false;
    window.fbq("track", queued.name, queued.params, queued.eventId ? { eventID: queued.eventId } : undefined);
    return true;
  }
  if (typeof window.gtag === "function") {
    window.gtag("event", queued.name, queued.params);
    return true;
  }
  if (GTM_CONTAINER && queued.legacy && Array.isArray(window.dataLayer)) {
    window.dataLayer.push(queued.legacy);
    return true;
  }
  return false;
}

function drain(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (typeof window === "undefined") return;
  // Withdrawal discards the buffer outright. Events captured before an opt-out
  // must not be replayed if the shopper opts back in later in the same session.
  if (!consentGranted()) {
    queue.length = 0;
    retries = 0;
    return;
  }
  // Filter rather than head-of-line drain: Google and Meta become ready at
  // different moments, and order only has to hold within a destination.
  const pending = queue.splice(0, queue.length);
  for (const queued of pending) if (!deliver(queued)) queue.push(queued);
  if (queue.length === 0) {
    retries = 0;
    return;
  }
  if (retries >= MAX_RETRIES) {
    queue.length = 0;
    retries = 0;
    return;
  }
  retries += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    drain();
  }, RETRY_MS);
}

function enqueue(queued: QueuedEvent): void {
  if (queue.length >= MAX_QUEUED) queue.shift();
  queue.push(queued);
}

/**
 * Retry the buffer from the top. Called by `<GoogleAnalytics />` on the
 * consent-granted transition, when the tag scripts first mount.
 */
export function flushCommerceEvents(): void {
  try {
    retries = 0;
    drain();
  } catch {
    /* analytics is fire-and-forget */
  }
}

const toMajorUnits = (cents: number): number => Math.round(cents) / 100;

function toGa4Item(item: CommerceEventItem): TagParams {
  const mapped: TagParams = { item_id: item.itemId };
  if (item.itemName) mapped.item_name = item.itemName;
  if (item.itemVariant) mapped.item_variant = item.itemVariant;
  if (typeof item.priceCents === "number") mapped.price = toMajorUnits(item.priceCents);
  if (typeof item.quantity === "number") mapped.quantity = item.quantity;
  return mapped;
}

/**
 * Flat AHA payload → real GA4 ecommerce parameters. On an item-scoped event
 * `valueCents` is the line total, so the per-unit `price` is derived from it.
 * Cart-level events can pass their complete product-only `items[]` snapshot;
 * when an older call site has no lines yet, preserve value plus `item_count`
 * instead of inventing partial item data.
 */
export function toGa4Params(event: CommerceEvent): TagParams {
  const params: TagParams = {};
  if (event.currency) params.currency = event.currency;
  if (typeof event.valueCents === "number") params.value = toMajorUnits(event.valueCents);
  if (event.transactionId) params.transaction_id = event.transactionId;
  if (typeof event.resultCount === "number") params.result_count = event.resultCount;

  const units = event.quantity && event.quantity > 0 ? event.quantity : 1;
  const items: CommerceEventItem[] = event.items ?? (event.itemId
    ? [{
        itemId: event.itemId,
        itemName: event.itemName,
        itemVariant: event.itemVariant ?? event.variantId,
        priceCents: typeof event.valueCents === "number" ? event.valueCents / units : undefined,
        quantity: event.quantity,
      }]
    : []);

  if (items.length > 0) params.items = items.map(toGa4Item);
  else if (typeof event.quantity === "number") params.item_count = event.quantity;
  return params;
}

export function trackCommerceEvent(event: CommerceEvent): void {
  if (typeof window === "undefined") return;
  try {
    const detail = { ...event, path: window.location.pathname };
    window.dispatchEvent(new CustomEvent("aha:commerce", { detail }));
    // Opt-in only. Pre-consent events are dropped here rather than buffered, so
    // nothing a shopper did before accepting can be transmitted afterwards.
    if (!consentGranted()) return;
    if (!isCanonicalAnalyticsHost(window.location.hostname)) return;
    enqueue({
      destination: "google",
      name: event.name,
      params: toGa4Params(event),
      legacy: { event: `aha_${event.name}`, ...detail },
    });
    flushCommerceEvents();
  } catch {
    /* analytics is fire-and-forget: never let it affect the shopper's flow */
  }
}

const PURCHASE_MARKER_PREFIX = "aha-purchase-tracked:";
const purchasesSent = new Set<string>();

function purchaseAlreadySent(orderNumber: string): boolean {
  if (purchasesSent.has(orderNumber)) return true;
  try {
    return sessionStorage.getItem(`${PURCHASE_MARKER_PREFIX}${orderNumber}`) === "1";
  } catch {
    return false;
  }
}

function markPurchaseSent(orderNumber: string): void {
  purchasesSent.add(orderNumber);
  try {
    sessionStorage.setItem(`${PURCHASE_MARKER_PREFIX}${orderNumber}`, "1");
  } catch {
    /* private mode — the in-memory guard still covers this page view */
  }
}

/**
 * The revenue event. Fires GA4 `purchase` and the Meta `Purchase` mirror at
 * most once per order number: `/order-confirmed` re-reads the same stored
 * summary on every refresh, and a refresh must not double-count revenue.
 * Nothing here can affect fulfilment — the order is already paid and queued.
 */
export function trackPurchase(order: PurchaseEvent): void {
  if (typeof window === "undefined" || !order.orderNumber) return;
  try {
    if (purchaseAlreadySent(order.orderNumber)) return;
    // No marker is written without consent, so the event can still fire if the
    // shopper opts in and reloads the confirmation page.
    if (!consentGranted()) return;
    markPurchaseSent(order.orderNumber);
    trackCommerceEvent({
      name: "purchase",
      transactionId: order.orderNumber,
      valueCents: order.totalCents,
      currency: order.currency,
      items: order.items,
    });
    enqueue({
      destination: "meta",
      name: "Purchase",
      eventId: order.orderNumber,
      params: {
        value: toMajorUnits(order.totalCents),
        currency: order.currency,
        content_type: "product",
        contents: order.items.map((item) => ({ id: item.itemId, quantity: item.quantity ?? 1 })),
      },
    });
    flushCommerceEvents();
  } catch {
    /* analytics is fire-and-forget: the order is confirmed either way */
  }
}
