// Fulfillment engine (§25). Runs only after Square payment succeeds. Each Printful store gets its
// own durable fulfillment row so retries and webhooks can reconcile provider orders independently.
// Confirmation remains gated by both explicit production flags.
import { printfulRequest } from "@/lib/printful/client";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, fulfillments, auditLog } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { RevalidatedCart, OrderContact } from "./orders";
import {
  aggregateFulfillmentStatus, groupItemsByPrintfulStore, isPrintfulConfirmationAllowed,
} from "./fulfillment-state";

function confirmAllowed(): boolean {
  return isPrintfulConfirmationAllowed({
    fulfillmentMode: process.env.AHA_FULFILLMENT_MODE,
    allowConfirm: process.env.PRINTFUL_ALLOW_CONFIRM_ORDERS,
    liveMode: process.env.PRINTFUL_LIVE_MODE,
  });
}

interface PrintfulOrderResponse { data?: { id?: number | string }; id?: number | string }

function customerStatus(status: string): string {
  switch (status) {
    case "draft_created": return "Preparing your order";
    case "confirmed": return "In production";
    case "partially_shipped": return "Partially shipped";
    case "shipped": return "Shipped";
    case "delivered": return "Delivered";
    case "manual_review": return "Action needed";
    case "canceled": return "Canceled";
    default: return "Payment confirmed";
  }
}

export async function syncOrderFulfillmentStatus(orderId: number): Promise<string> {
  const rows = await db().select({ status: fulfillments.status })
    .from(fulfillments).where(eq(fulfillments.orderId, orderId));
  const status = aggregateFulfillmentStatus(rows.map((row) => row.status));
  await db().update(orders)
    .set({ fulfillmentStatus: status, customerStatus: customerStatus(status), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return status;
}

async function markManualReview(orderId: number, reason: string): Promise<void> {
  await db().update(orders)
    .set({ fulfillmentStatus: "manual_review", customerStatus: "Action needed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "fulfillment:manual_review",
    newStatus: "manual_review", source: "fulfillment", metadataJson: { reason },
  });
}

/**
 * Create one Printful draft per owning store. A unique (order, store) row is claimed before the
 * remote call, preventing concurrent retries from creating two drafts for the same provider store.
 */
export async function startFulfillment(
  orderId: number, cart: RevalidatedCart, contact: OrderContact
): Promise<void> {
  if (!isDbConfigured()) return;

  const defaultStore = Number(process.env.PRINTFUL_STORE_ID) || undefined;
  const byStore = groupItemsByPrintfulStore(cart.items, defaultStore);
  if (byStore.size === 0) {
    await markManualReview(orderId, "No cart item has a Printful sync-variant/store mapping");
    return;
  }

  const addr = (contact.shippingAddress ?? {}) as Record<string, string>;
  const recipient = {
    name: contact.shippingName || contact.email,
    address1: addr.address1,
    city: addr.city,
    state_code: addr.state || undefined,
    country_code: addr.country || "US",
    zip: addr.zip,
    email: contact.email,
  };

  for (const [storeId, items] of Array.from(byStore)) {
    const [existing] = await db().select({
      id: fulfillments.id,
      printfulOrderId: fulfillments.printfulOrderId,
      status: fulfillments.status,
    }).from(fulfillments).where(and(
      eq(fulfillments.orderId, orderId),
      eq(fulfillments.providerStoreId, storeId)
    )).limit(1);

    if (existing?.printfulOrderId) continue;
    if (existing?.status === "draft_creating") {
      await markManualReview(orderId, `Printful store ${storeId} has an unresolved draft creation attempt`);
      continue;
    }

    const claimed = existing
      ? await db().update(fulfillments).set({ status: "draft_creating", lastError: null, updatedAt: new Date() })
          .where(eq(fulfillments.id, existing.id)).returning({ id: fulfillments.id })
      : await db().insert(fulfillments).values({
          orderId, providerStoreId: storeId, status: "draft_creating",
        }).onConflictDoNothing().returning({ id: fulfillments.id });

    if (!claimed[0]) continue; // another request claimed this order/store pair

    try {
      const res = await printfulRequest<PrintfulOrderResponse>("/orders", {
        method: "POST",
        storeId: String(storeId),
        body: { recipient, order_items: items },
      });
      const printfulOrderId = String(res?.data?.id ?? res?.id ?? "");
      if (!printfulOrderId) throw new Error(`Printful draft order (store ${storeId}) returned no id`);

      let status = "draft_created";
      if (confirmAllowed()) {
        await printfulRequest(`/orders/${printfulOrderId}/confirmation`, {
          method: "POST", storeId: String(storeId),
        });
        status = "confirmed";
      }

      await db().update(fulfillments).set({
        printfulOrderId, status, lastError: null, updatedAt: new Date(),
      }).where(eq(fulfillments.id, claimed[0].id));

      // Legacy single-id column remains a pointer to the first provider order only.
      await db().update(orders).set({ printfulOrderId, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), isNull(orders.printfulOrderId)));
      await db().insert(auditLog).values({
        entityType: "order", entityId: String(orderId), action: `fulfillment:${status}`,
        newStatus: status, source: "fulfillment",
        metadataJson: { printfulOrderId, storeId, confirmAllowed: confirmAllowed() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Printful draft creation failed";
      await db().update(fulfillments).set({
        status: "manual_review", lastError: message, updatedAt: new Date(),
      }).where(eq(fulfillments.id, claimed[0].id));
      await syncOrderFulfillmentStatus(orderId);
      throw error;
    }
  }

  await syncOrderFulfillmentStatus(orderId);
}
