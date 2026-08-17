import { and, eq, inArray, lt } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { auditLog, fulfillments, orderItems, orders } from "@/db/schema";
import { startFulfillment } from "./fulfillment";
import { revalidateCartForFulfillmentRetry, type OrderContact, type RevalidatedCart } from "./orders";
import {
  FulfillmentSnapshotError,
  isLegacyPrintfulSnapshotRepairEligible,
  rebuildFulfillmentCartFromSnapshots,
  type PersistedFulfillmentItem,
} from "./fulfillment-snapshot";

async function markFulfillmentManualReview(orderId: number, reason: string): Promise<void> {
  const safeReason = reason.slice(0, 500);
  await db().update(orders).set({
    fulfillmentStatus: "manual_review", customerStatus: "Action needed", updatedAt: new Date(),
  }).where(eq(orders.id, orderId));
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "fulfillment:manual_review",
    newStatus: "manual_review", source: "reconciliation", metadataJson: { reason: safeReason },
  });
}

function assertLegacyRepairMatchesPaidItems(cart: RevalidatedCart, items: PersistedFulfillmentItem[]): void {
  if (cart.items.length !== items.length) throw new Error("Legacy Printful repair changed the paid order item count");
  for (let index = 0; index < items.length; index += 1) {
    const paid = items[index];
    const repaired = cart.items[index];
    if (repaired.fulfillmentProvider !== "printful" || paid.ahaProductId !== repaired.ahaProductId ||
      paid.ahaVariantId !== repaired.ahaVariantId || paid.sku !== repaired.sku ||
      paid.squareVariationId !== repaired.squareVariationId ||
      (paid.printfulCatalogVariantId && paid.printfulCatalogVariantId !== repaired.printfulCatalogVariantId)) {
      throw new Error("Legacy Printful repair did not match the immutable paid item identity");
    }
  }
}

export async function retryOrderFulfillment(orderId: number): Promise<void> {
  if (!isDbConfigured()) throw new Error("Production order store is unavailable.");
  const [order] = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.paymentStatus !== "paid") throw new Error("Only paid orders can enter fulfillment.");
  const items = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId)) as PersistedFulfillmentItem[];
  if (!items.length) throw new Error("Order has no fulfillment items.");

  // Paid orders use the provider/art/SKU captured at purchase time. The only
  // live-catalog exception is a strictly-identical legacy Printful repair for
  // records that genuinely predate snapshots; malformed snapshots never fall
  // through to current catalog data.
  let cart: RevalidatedCart;
  try {
    cart = rebuildFulfillmentCartFromSnapshots(items, order.currency, order.subtotalAmount);
  } catch (error) {
    const canRepairLegacyPrintful = error instanceof FulfillmentSnapshotError && error.kind === "missing" &&
      isLegacyPrintfulSnapshotRepairEligible(items);
    if (!canRepairLegacyPrintful) {
      const reason = error instanceof Error ? error.message : "Paid order fulfillment snapshot could not be reconstructed";
      await markFulfillmentManualReview(order.id, reason);
      throw error;
    }
    try {
      const derived = revalidateCartForFulfillmentRetry(
        items.map((item) => ({ squareVariationId: item.squareVariationId || "", quantity: item.quantity }))
      );
      assertLegacyRepairMatchesPaidItems(derived, items);
      cart = { currency: order.currency, subtotal: order.subtotalAmount, items: derived.items };
    } catch (repairError) {
      const reason = repairError instanceof Error ? repairError.message : "Legacy Printful repair failed";
      await markFulfillmentManualReview(order.id, reason);
      throw repairError;
    }
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
