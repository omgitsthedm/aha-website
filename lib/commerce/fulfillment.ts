// Fulfillment engine (§25). Runs only after Square payment succeeds. Each Printful store gets its
// own durable fulfillment row so retries and webhooks can reconcile provider orders independently.
// Confirmation remains gated by both explicit production flags.
import { printfulRequest } from "@/lib/printful/client";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, fulfillments, auditLog } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { RevalidatedCart, OrderContact } from "./orders";
import {
  aggregateFulfillmentStatus, buildStoreOrderRequest, groupSourceItemsByPrintfulStore,
  isPrintfulConfirmationAllowed, shouldRetryPrintfulConfirmation,
} from "./fulfillment-state";
import { dispatchOrderNotifications, enqueueOrderNotification } from "./notifications";

function confirmAllowed(): boolean {
  return isPrintfulConfirmationAllowed({
    fulfillmentMode: process.env.AHA_FULFILLMENT_MODE,
    allowConfirm: process.env.PRINTFUL_ALLOW_CONFIRM_ORDERS,
    liveMode: process.env.PRINTFUL_LIVE_MODE,
  });
}

interface PrintfulOrderResponse { data?: { id?: number | string }; result?: { id?: number | string }; id?: number | string }

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
  await enqueueOrderNotification(orderId, "fulfillment_attention", { reason });
  await dispatchOrderNotifications(5, orderId).catch(() => {});
}

async function confirmPrintfulOrder(orderId: number, fulfillmentId: number, printfulOrderId: string, storeId: number): Promise<void> {
  try {
    // v1 confirm — order ids share one space across API versions, and v1 is the
    // only version that can confirm sync-fulfilled orders (v2 dropped sync 2026-07).
    await printfulRequest(`/orders/${printfulOrderId}/confirm`, { method: "POST", storeId: String(storeId), apiVersion: "v1" });
    await db().update(fulfillments).set({ status: "confirmed", lastError: null, updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId));
    await db().insert(auditLog).values({
      entityType: "order", entityId: String(orderId), action: "fulfillment:confirmed",
      newStatus: "confirmed", source: "fulfillment", metadataJson: { printfulOrderId, storeId, confirmAllowed: true },
    });
    await enqueueOrderNotification(orderId, "order_in_production");
    await dispatchOrderNotifications(5, orderId).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Printful confirmation failed";
    await db().update(fulfillments).set({ status: "confirmation_failed", lastError: message, updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId));
    await markManualReview(orderId, message);
    throw error;
  }
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
  const byStore = groupSourceItemsByPrintfulStore(cart.items, defaultStore);
  if (byStore.size === 0) {
    await markManualReview(orderId, "No cart item has a Printful fulfillment path (sync variant or catalog placements with hosted art)");
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

    if (existing?.printfulOrderId) {
      if (shouldRetryPrintfulConfirmation({
        confirmationAllowed: confirmAllowed(), printfulOrderId: existing.printfulOrderId, status: existing.status,
      })) {
        await confirmPrintfulOrder(orderId, existing.id, existing.printfulOrderId, storeId);
      }
      continue;
    }
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

    let createdPrintfulOrderId = "";
    try {
      const request = buildStoreOrderRequest(items, recipient);
      if (!request) throw new Error(`No fulfillable Printful items for store ${storeId}`);
      const res = await printfulRequest<PrintfulOrderResponse>("/orders", {
        method: "POST",
        storeId: String(storeId),
        apiVersion: request.apiVersion,
        body: request.body,
      });
      const printfulOrderId = String(res?.data?.id ?? res?.result?.id ?? res?.id ?? "");
      if (!printfulOrderId) throw new Error(`Printful draft order (store ${storeId}) returned no id`);
      createdPrintfulOrderId = printfulOrderId;

      // Persist the remote id before confirmation so any confirmation failure can retry the same
      // Printful order instead of creating a duplicate production order.
      await db().update(fulfillments).set({
        printfulOrderId, status: "draft_created", lastError: null, updatedAt: new Date(),
      }).where(eq(fulfillments.id, claimed[0].id));
      await db().update(orders).set({ printfulOrderId, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), isNull(orders.printfulOrderId)));
      await db().insert(auditLog).values({
        entityType: "order", entityId: String(orderId), action: "fulfillment:draft_created",
        newStatus: "draft_created", source: "fulfillment", metadataJson: { printfulOrderId, storeId },
      });

      if (confirmAllowed()) {
        await confirmPrintfulOrder(orderId, claimed[0].id, printfulOrderId, storeId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Printful draft creation failed";
      if (!createdPrintfulOrderId) {
        await db().update(fulfillments).set({ status: "manual_review", lastError: message, updatedAt: new Date() })
          .where(eq(fulfillments.id, claimed[0].id));
      }
      await syncOrderFulfillmentStatus(orderId);
      await enqueueOrderNotification(orderId, "fulfillment_attention", { reason: message });
      await dispatchOrderNotifications(5, orderId).catch(() => {});
      throw error;
    }
  }

  await syncOrderFulfillmentStatus(orderId);
}
