import { and, eq, inArray, lt } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { fulfillments, orderItems, orders } from "@/db/schema";
import { startFulfillment } from "./fulfillment";
import { revalidateCart, type OrderContact, type RevalidatedCart, type RevalidatedItem } from "./orders";

export async function retryOrderFulfillment(orderId: number): Promise<void> {
  if (!isDbConfigured()) throw new Error("Production order store is unavailable.");
  const [order] = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.paymentStatus !== "paid") throw new Error("Only paid orders can enter fulfillment.");
  const items = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId));
  if (!items.length) throw new Error("Order has no fulfillment items.");

  // Re-derive the FULL fulfillment DNA (placements, product options, store id, catalog/sync
  // variant ids) from the live manifest by squareVariationId — exactly the way create-payment
  // built the order. This is the authoritative source and fixes the prior bug where the retry
  // rebuilt catalog items WITHOUT placements (→ permanent manual_review). Fulfillment ignores
  // retail price, so re-pricing in the derived cart is harmless. If a variant has since left the
  // catalog, fall back to the persisted snapshot (now reading every field, not just sync id).
  let cart: RevalidatedCart;
  try {
    const derived = revalidateCart(
      items.map((item) => ({ squareVariationId: item.squareVariationId || "", quantity: item.quantity }))
    );
    cart = { currency: order.currency, subtotal: order.subtotalAmount, items: derived.items };
  } catch {
    cart = {
      currency: order.currency,
      subtotal: order.subtotalAmount,
      items: items.map((item) => {
        const snapshot = (item.printfulFileSnapshotJson || {}) as {
          printfulSyncVariantId?: number;
          printfulStoreId?: number;
          printfulPlacements?: RevalidatedItem["printfulPlacements"];
          printfulProductOptions?: RevalidatedItem["printfulProductOptions"];
        };
        return {
          ahaProductId: item.ahaProductId,
          ahaVariantId: item.ahaVariantId,
          sku: item.sku,
          title: item.titleSnapshot,
          size: item.sizeSnapshot || "",
          color: item.colorSnapshot || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          squareVariationId: item.squareVariationId || "",
          printfulCatalogVariantId: item.printfulCatalogVariantId || undefined,
          printfulSyncVariantId: snapshot.printfulSyncVariantId,
          printfulStoreId: snapshot.printfulStoreId,
          printfulPlacements: snapshot.printfulPlacements,
          printfulProductOptions: snapshot.printfulProductOptions,
        };
      }),
    };
  }
  const contact: OrderContact = {
    email: order.email,
    phone: order.phone || undefined,
    shippingName: order.shippingName || undefined,
    shippingAddress: (order.shippingAddressJson || undefined) as Record<string, unknown> | undefined,
  };
  await startFulfillment(order.id, cart, contact);
}

export async function reconcilePaidOrders(limit = 5): Promise<{ attempted: number; failed: number }> {
  if (!isDbConfigured()) return { attempted: 0, failed: 0 };
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  await db().update(fulfillments).set({ status: "manual_review", lastError: "Recovered stale draft claim", updatedAt: new Date() })
    .where(and(eq(fulfillments.status, "draft_creating"), lt(fulfillments.updatedAt, staleBefore)));
  const candidates = await db().select({ id: orders.id }).from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), inArray(orders.fulfillmentStatus, ["not_started", "manual_review", "draft_creating"])))
    .limit(limit);
  let failed = 0;
  for (const candidate of candidates) {
    try { await retryOrderFulfillment(candidate.id); } catch { failed += 1; }
  }
  return { attempted: candidates.length, failed };
}
