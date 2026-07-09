// Fulfillment engine (§25). Runs AFTER Square payment succeeds. Creates a Printful v2 DRAFT order
// from the store's sync variants (art configured server-side). The order is only CONFIRMED (charged
// to us + sent to production) when BOTH live flags are on — otherwise it stays a safe draft.
import { printfulRequest } from "@/lib/printful/client";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, fulfillments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { RevalidatedCart, OrderContact } from "./orders";

function confirmAllowed(): boolean {
  return process.env.PRINTFUL_ALLOW_CONFIRM_ORDERS === "true" && process.env.PRINTFUL_LIVE_MODE === "true";
}

interface PrintfulOrderResponse { data?: { id?: number | string }; id?: number | string }

async function setFulfillment(orderId: number, status: string, printfulOrderId: string | null): Promise<void> {
  await db().update(orders)
    .set({ fulfillmentStatus: status, printfulOrderId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await db().insert(fulfillments).values({ orderId, printfulOrderId, status });
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: `fulfillment:${status}`,
    newStatus: status, source: "fulfillment", metadataJson: { printfulOrderId, confirmAllowed: confirmAllowed() },
  });
}

/**
 * Create (and, if allowed, confirm) the Printful order for a paid internal order.
 * Idempotency: skips if the order already has a printful_order_id.
 */
export async function startFulfillment(
  orderId: number, cart: RevalidatedCart, contact: OrderContact
): Promise<void> {
  if (!isDbConfigured()) return;

  const [existing] = await db().select({ pf: orders.printfulOrderId, status: orders.fulfillmentStatus })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  if (existing?.pf) return; // already has a Printful order — don't duplicate

  // Group items by the Printful store their variant lives in (Square-integrated vs native/API store).
  // A cart can mix both → one Printful draft order per store.
  const defaultStore = Number(process.env.PRINTFUL_STORE_ID) || undefined;
  const byStore = new Map<number, Array<{ source: string; sync_variant_id: number; quantity: number }>>();
  for (const i of cart.items) {
    if (!i.printfulSyncVariantId) continue;
    const store = i.printfulStoreId || defaultStore;
    if (!store) continue;
    if (!byStore.has(store)) byStore.set(store, []);
    byStore.get(store)!.push({ source: "sync_variant", sync_variant_id: i.printfulSyncVariantId, quantity: i.quantity });
  }

  if (byStore.size === 0) {
    // Nothing maps to Printful — route to manual review rather than silently dropping.
    await setFulfillment(orderId, "manual_review", null);
    return;
  }

  const addr = (contact.shippingAddress ?? {}) as Record<string, string>;
  const recipient = {
    name: contact.shippingName || contact.email,
    address1: addr.address1, city: addr.city,
    state_code: addr.state || undefined, country_code: addr.country || "US", zip: addr.zip,
    email: contact.email,
  };

  const createdIds: string[] = [];
  for (const [store, items] of Array.from(byStore)) {
    const res = await printfulRequest<PrintfulOrderResponse>("/orders", {
      method: "POST", storeId: String(store), body: { recipient, order_items: items },
    });
    const printfulOrderId = String(res?.data?.id ?? res?.id ?? "");
    if (!printfulOrderId) throw new Error(`Printful draft order (store ${store}) returned no id`);
    createdIds.push(printfulOrderId);
    if (confirmAllowed()) {
      await printfulRequest(`/orders/${printfulOrderId}/confirmation`, { method: "POST", storeId: String(store) });
    }
  }

  await setFulfillment(orderId, confirmAllowed() ? "confirmed" : "draft_created", createdIds.join(",") || null);
}
