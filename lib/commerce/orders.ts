// Order layer: server-side cart revalidation (never trust client prices) + DB persistence.
// Payment status and fulfillment status are tracked separately (§14/§28).
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, orderItems, payments, auditLog, type OrderItemFulfillmentStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { INTERNATIONAL_SHIPPING_CENTS, isInternational } from "@/lib/commerce/policies";
import { assertLegacyCatalogCheckoutAllowed, assertVariantSellable } from "@/lib/commerce/catalog-policy";
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
  fulfillmentProvider: AhaVariant["fulfillmentProvider"];
  providerVariantId?: string;
  providerSku?: string;
  providerSnapshot: Record<string, unknown>;
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

/**
 * Per-line fulfillment starts where the order does. This used to be left to the
 * column default, which is how it read as "a value nobody writes"; the APLIIQ
 * reconciler now advances it, so the starting point is stated here on purpose.
 */
const INITIAL_ORDER_ITEM_STATUS: OrderItemFulfillmentStatus = "not_started";

/**
 * Build the immutable order-item records used by both the initial fulfillment
 * call and every later reconciliation. Keeping this projection pure makes the
 * paid snapshot contract directly testable without touching a database.
 */
export function buildOrderItemRecords(orderId: number, items: readonly RevalidatedItem[]) {
  return items.map((it) => ({
    orderId, ahaProductId: it.ahaProductId, ahaVariantId: it.ahaVariantId, sku: it.sku,
    fulfillmentStatus: INITIAL_ORDER_ITEM_STATUS,
    titleSnapshot: it.title, sizeSnapshot: it.size, colorSnapshot: it.color ?? null,
    quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: it.lineTotal,
    squareVariationId: it.squareVariationId,
    printfulCatalogVariantId: it.printfulCatalogVariantId ?? null,
    fulfillmentProvider: it.fulfillmentProvider ?? "printful",
    providerVariantId: it.providerVariantId ?? null,
    providerSku: it.providerSku ?? null,
    providerSnapshotJson: it.providerSnapshot,
    printfulPlacementSnapshotJson: null,
    printfulFileSnapshotJson: it.printfulSyncVariantId
      ? { printfulSyncVariantId: it.printfulSyncVariantId, printfulStoreId: it.printfulStoreId }
      : {
        printfulPlacements: it.printfulPlacements ?? [],
        printfulProductOptions: it.printfulProductOptions ?? [],
        printfulStoreId: it.printfulStoreId,
      },
  }));
}

/** Block an unsupported APLIIQ destination before Square pricing or payment. */
export function assertCartFulfillableToCountry(
  cart: RevalidatedCart,
  country: string | undefined,
): void {
  const countryCode = country?.trim().toUpperCase();
  for (const item of cart.items) {
    if (item.fulfillmentProvider !== "apliiq") continue;
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error("APLIIQ items require a valid two-letter shipping country code.");
    }
    const regions = Array.isArray(item.providerSnapshot.regions)
      ? item.providerSnapshot.regions.filter((value): value is string => typeof value === "string")
      : [];
    if (!regions.includes(countryCode)) {
      throw new Error(`"${item.title}" is not available for shipping to ${countryCode}.`);
    }
  }
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

function revalidateCatalogLines(lines: CheckoutLine[]): RevalidatedCart {
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
    // NOTE: the sellable-provider guard deliberately does NOT live here.
    // revalidateCatalogLines is shared by public checkout and by fulfillment
    // recovery for orders paid BEFORE the hold; blocking legacy lines here
    // would strand a customer who has already been charged. The guard belongs
    // on the public path only — see revalidateCart.
    const readiness = checkVariantPurchasable(product, variant);
    if (!readiness.ok) {
      throw new Error(`"${product.title}" (${variant.size}) is not currently purchasable: ${readiness.reasons.join(", ")}.`);
    }
    const unitPrice = variant.retailPrice;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    currency = variant.currency || currency;
    items.push({
      ahaProductId: product.ahaProductId, ahaVariantId: variant.ahaVariantId, sku: variant.sku,
      title: product.title, size: variant.size, color: variant.color, quantity: qty,
      unitPrice, lineTotal, squareVariationId: variant.squareVariationId!,
      fulfillmentProvider: variant.fulfillmentProvider ?? "printful",
      providerVariantId: variant.fulfillmentProvider === "apliiq"
        ? variant.apliiqVariantId
        : String(variant.printfulCatalogVariantId ?? ""),
      providerSku: variant.fulfillmentProvider === "apliiq" ? variant.apliiqSku : variant.sku,
      providerSnapshot: variant.fulfillmentProvider === "apliiq"
        ? {
          apliiqProductId: variant.apliiqProductId,
          apliiqVariantId: variant.apliiqVariantId,
          apliiqSku: variant.apliiqSku,
          decoration: variant.apliiqDecorationSnapshot,
          privateLabel: variant.apliiqPrivateLabelSnapshot,
          assetUrls: variant.apliiqAssetUrls,
          regions: variant.apliiqRegionAvailability,
          sizeGuideReference: variant.apliiqSizeGuideReference,
          mappingApproval: variant.apliiqMappingApproval,
          sampleApproval: variant.apliiqSampleApproval,
          costEstimate: variant.costEstimate,
          marginEstimate: variant.marginEstimate,
          costVerifiedAt: variant.costVerifiedAt,
          marginVerifiedAt: variant.marginVerifiedAt,
          // Purchase-time landed-cost evidence. weightOz is what the APLIIQ
          // adapter turns into the wire `grams` field, so it has to be frozen
          // with the order rather than re-read from a catalog that may have
          // been re-weighed since.
          weightOz: variant.weightOz,
          apliiqItemCost: variant.apliiqItemCost,
          apliiqShippingCost: variant.apliiqShippingCost,
          apliiqFulfillmentFeeCents: variant.apliiqFulfillmentFeeCents,
          apliiqDestinationTaxCents: variant.apliiqDestinationTaxCents,
        }
        : {
          printfulCatalogVariantId: variant.printfulCatalogVariantId,
          printfulSyncVariantId: variant.printfulSyncVariantId,
          printfulStoreId: variant.printfulStoreId,
          printfulPlacements: variant.printfulPlacements ?? [],
          printfulProductOptions: variant.printfulProductOptions ?? [],
          printfulRegionAvailability: variant.printfulRegionAvailability ?? [],
        },
      printfulCatalogVariantId: variant.printfulCatalogVariantId,
      printfulSyncVariantId: variant.printfulSyncVariantId,
      printfulStoreId: variant.printfulStoreId,
      printfulPlacements: variant.printfulPlacements,
      printfulProductOptions: variant.printfulProductOptions,
    });
  }
  return { items, subtotal, currency };
}

/** Recompute a public checkout cart from server truth. */
export function revalidateCart(lines: CheckoutLine[]): RevalidatedCart {
  // This is intentionally the first checkout guard. A stale local cart must
  // fail before its Square variation can be priced or attached to an order.
  assertLegacyCatalogCheckoutAllowed();
  const cart = revalidateCatalogLines(lines);
  // Then per line: the till being open for the APLIIQ capsule does not make a
  // legacy Printful line sellable, and a browser cart saved before the reset
  // still holds them.
  for (const item of cart.items) {
    assertVariantSellable(item.fulfillmentProvider, `"${item.title}" (${item.size})`);
  }
  return cart;
}

/**
 * Rebuild fulfillment DNA for an order that was already paid before the
 * catalog hold. This does not authorize a charge or a new order; reconciliation
 * falls back to the immutable order-item snapshot if the legacy manifest no
 * longer contains the variant.
 */
export function revalidateCartForFulfillmentRetry(lines: CheckoutLine[]): RevalidatedCart {
  return revalidateCatalogLines(lines);
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
  // US ships free; CA/GB/AU carry a real flat service charge on the Square order,
  // so the freight column has to record it too. Square still owns `total`.
  const shippingCountry =
    typeof contact.shippingAddress?.country === "string" ? contact.shippingAddress.country : undefined;
  const shipping = isInternational(shippingCountry) ? INTERNATIONAL_SHIPPING_CENTS : 0;
  const grossSubtotal = cart.subtotal; // pre-discount line-item total
  // Square's `subtotal` is total − tax, which still contains the TOTAL_PHASE shipping
  // service charge. Strip the freight before deriving the promo discount, or a
  // discounted international order records $20 less discount than it actually got.
  const netSubtotal = pricing ? Math.max(0, pricing.subtotal - shipping) : cart.subtotal;
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
      // with Square (gross − discount + tax + shipping = total). Square holds the
      // discount name/code; we keep the amount.
      currency, subtotalAmount: grossSubtotal, discountAmount, shippingAmount: shipping, taxAmount: tax,
      totalAmount: total, paymentStatus: "created", fulfillmentStatus: "not_started",
    })
    .returning({ id: orders.id });

  await db().insert(orderItems).values(buildOrderItemRecords(order.id, cart.items));

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
