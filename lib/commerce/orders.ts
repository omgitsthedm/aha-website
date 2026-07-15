// Order layer: server-side cart revalidation (never trust client prices) + DB persistence.
// Payment status and fulfillment status are tracked separately (§14/§28).
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, orderItems, payments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadProducts } from "@/lib/data/products";
import type { AhaProduct, AhaVariant } from "@/lib/types/product";

export interface CheckoutLine {
  squareVariationId: string;
  quantity: number;
}
export interface OrderContact {
  email: string;
  phone?: string;
  shippingName?: string;
  shippingAddress?: Record<string, unknown>;
}
export interface RevalidatedItem {
  ahaProductId: string;
  ahaVariantId: string;
  sku: string;
  title: string;
  size: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  squareVariationId: string;
  printfulCatalogVariantId?: number;
  printfulSyncVariantId?: number;
  printfulStoreId?: number;
  printfulPlacements?: AhaVariant["printfulPlacements"];
  printfulProductOptions?: AhaVariant["printfulProductOptions"];
}
export interface RevalidatedCart {
  items: RevalidatedItem[];
  subtotal: number;
  currency: string;
}

interface IndexEntry { product: AhaProduct; variant: AhaVariant }

function variationIndex(): Map<string, IndexEntry> {
  const idx = new Map<string, IndexEntry>();
  for (const product of loadProducts()) {
    for (const variant of product.variants) {
      if (variant.squareVariationId) idx.set(variant.squareVariationId, { product, variant });
    }
  }
  return idx;
}

/** Recompute the cart from server truth. Throws if any line is unknown or not purchasable. */
export function revalidateCart(lines: CheckoutLine[]): RevalidatedCart {
  if (!lines.length) throw new Error("Cart is empty.");
  const idx = variationIndex();
  const items: RevalidatedItem[] = [];
  let subtotal = 0;
  let currency = "USD";

  for (const line of lines) {
    const qty = Math.max(1, Math.min(20, Math.floor(line.quantity)));
    const hit = idx.get(line.squareVariationId);
    if (!hit) throw new Error(`Item no longer available (${line.squareVariationId}).`);
    const { product, variant } = hit;
    if (product.status !== "active" || variant.status !== "active") {
      throw new Error(`"${product.title}" (${variant.size}) is no longer available.`);
    }
    const unitPrice = variant.retailPrice;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    currency = variant.currency || currency;
    items.push({
      ahaProductId: product.ahaProductId, ahaVariantId: variant.ahaVariantId, sku: variant.sku,
      title: product.title, size: variant.size, color: variant.color, quantity: qty,
      unitPrice, lineTotal, squareVariationId: variant.squareVariationId!,
      printfulCatalogVariantId: variant.printfulCatalogVariantId,
      printfulSyncVariantId: variant.printfulSyncVariantId,
      printfulStoreId: variant.printfulStoreId,
      printfulPlacements: variant.printfulPlacements,
      printfulProductOptions: variant.printfulProductOptions,
    });
  }
  return { items, subtotal, currency };
}

function orderNumber(): string {
  return `AHA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, "0")}`;
}

/** Square-authoritative pricing (price + location tax) to charge and persist. */
export interface OrderPricing {
  squareOrderId: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

/** Persist a new order (payment_status=created) with purchase-time snapshots. Returns ids. */
export async function createOrder(
  cart: RevalidatedCart,
  contact: OrderContact,
  pricing?: OrderPricing
): Promise<{ orderId: number; externalOrderNumber: string; total: number }> {
  if (!isDbConfigured()) throw new Error("Order store unavailable.");
  const external = orderNumber();
  const shipping = 0; // free shipping (brand policy)
  const grossSubtotal = cart.subtotal; // pre-discount line-item total
  const netSubtotal = pricing?.subtotal ?? cart.subtotal; // Square's post-discount subtotal
  const discountAmount = Math.max(0, grossSubtotal - netSubtotal); // itemized promo savings
  const tax = pricing?.tax ?? 0;
  const total = pricing?.total ?? cart.subtotal + shipping;
  const currency = pricing?.currency ?? cart.currency;

  const [order] = await db()
    .insert(orders)
    .values({
      externalOrderNumber: external, email: contact.email, phone: contact.phone,
      shippingName: contact.shippingName, shippingAddressJson: contact.shippingAddress ?? null,
      squareOrderId: pricing?.squareOrderId ?? null,
      // Store the GROSS subtotal + the discount separately so records reconcile
      // with Square (gross − discount + tax = total). Square holds the discount
      // name/code; we keep the amount.
      currency, subtotalAmount: grossSubtotal, discountAmount, shippingAmount: shipping, taxAmount: tax,
      totalAmount: total, paymentStatus: "created", fulfillmentStatus: "not_started",
    })
    .returning({ id: orders.id });

  await db().insert(orderItems).values(
    cart.items.map((it) => ({
      orderId: order.id, ahaProductId: it.ahaProductId, ahaVariantId: it.ahaVariantId, sku: it.sku,
      titleSnapshot: it.title, sizeSnapshot: it.size, colorSnapshot: it.color ?? null,
      quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: it.lineTotal,
      squareVariationId: it.squareVariationId, printfulCatalogVariantId: it.printfulCatalogVariantId ?? null,
      printfulFileSnapshotJson: it.printfulSyncVariantId
        ? { printfulSyncVariantId: it.printfulSyncVariantId, printfulStoreId: it.printfulStoreId }
        : { printfulPlacements: it.printfulPlacements ?? [], printfulProductOptions: it.printfulProductOptions ?? [], printfulStoreId: it.printfulStoreId },
    }))
  );

  await db().insert(auditLog).values({
    entityType: "order", entityId: String(order.id), action: "created",
    newStatus: "created", source: "create-payment", metadataJson: { external, total },
  });
  return { orderId: order.id, externalOrderNumber: external, total };
}

/** If a payment with this idempotency key already succeeded, return the order it belongs to. */
export async function findPaidOrderByIdempotencyKey(
  idempotencyKey: string
): Promise<{ orderId: number; externalOrderNumber: string } | null> {
  if (!isDbConfigured()) return null;
  const [pay] = await db().select({ orderId: payments.orderId })
    .from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1);
  if (!pay?.orderId) return null;
  const [ord] = await db().select({ id: orders.id, num: orders.externalOrderNumber })
    .from(orders).where(eq(orders.id, pay.orderId)).limit(1);
  return ord ? { orderId: ord.id, externalOrderNumber: ord.num } : null;
}

export async function markOrderPaid(
  orderId: number, squarePaymentId: string, idempotencyKey: string, amount: number, currency: string
): Promise<void> {
  await db().update(orders)
    .set({ paymentStatus: "paid", squarePaymentId, customerStatus: "Payment confirmed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  // Records the payment; UNIQUE(idempotencyKey, squarePaymentId) enforces dedupe at the DB.
  await db().insert(payments).values({
    orderId, squarePaymentId, status: "paid", amount, currency, idempotencyKey,
  }).onConflictDoNothing();
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "paid",
    oldStatus: "created", newStatus: "paid", source: "create-payment",
    metadataJson: { squarePaymentId },
  });
}

export async function markOrderFailed(orderId: number, reason: string): Promise<void> {
  await db().update(orders)
    .set({ paymentStatus: "payment_failed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "payment_failed",
    oldStatus: "created", newStatus: "payment_failed", source: "create-payment", metadataJson: { reason },
  });
}
