interface FulfillmentSourcePlacement {
  placement: string;
  technique: string;
  fileUrl?: string;
  fileId?: number;
  /** Print position in inches; areaWidth/areaHeight are the blank's print-area
   *  size (needed to express the same box in the v1 pixel coordinate space). */
  position?: { width: number; height: number; top: number; left: number; areaWidth?: number; areaHeight?: number };
}

export interface FulfillmentSourceItem {
  printfulStoreId?: number;
  printfulSyncVariantId?: number;
  printfulCatalogVariantId?: number;
  printfulPlacements?: FulfillmentSourcePlacement[];
  printfulProductOptions?: { name: string; value: string | boolean | number }[];
  quantity: number;
}

interface PrintfulOrderLayer {
  type: "file";
  url: string;
  position?: { width: number; height: number; top: number; left: number };
}

const RETIRED_PRINTFUL_ASSET_ORIGIN = "https://afterhoursagenda.com";
const RETIRED_PRINTFUL_ASSET_PATH = "/printful-assets/";
const IMMUTABLE_PRINTFUL_ASSET_ARCHIVE =
  "https://raw.githubusercontent.com/omgitsthedm/aha-website/d255aa403b6bf4a978cb5f9af969a72cdc5c2488/public/printful-assets/";

/**
 * The retired public art directory is intentionally absent from the current
 * storefront. Paid-order snapshots and the legacy rollback map can still
 * contain those exact canonical URLs, so provider payloads resolve them to a
 * pinned Git object without making the old paths public on the custom site.
 */
export function resolvePrintfulAssetUrl(fileUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return fileUrl;
  }
  if (parsed.origin !== RETIRED_PRINTFUL_ASSET_ORIGIN || !parsed.pathname.startsWith(RETIRED_PRINTFUL_ASSET_PATH)) {
    return fileUrl;
  }
  const encodedName = parsed.pathname.slice(RETIRED_PRINTFUL_ASSET_PATH.length);
  let decodedName = "";
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch {
    return fileUrl;
  }
  if (!decodedName || decodedName.includes("/") || decodedName.includes("\\") || decodedName === "." || decodedName === "..") {
    return fileUrl;
  }
  return `${IMMUTABLE_PRINTFUL_ASSET_ARCHIVE}${encodedName}`;
}

/**
 * Printful v2 order item. Two fulfillment paths:
 * - sync_variant: the store's configured product carries the art (legacy path)
 * - catalog: blank + hosted art file per placement — no Printful store product
 *   needed. Verified against the live Square-platform store 2026-07-13.
 *
 * NOTE (2026-07-14): the v2 orders API no longer accepts source "sync_variant"
 * (valid sources today: catalog, warehouse, product_template). Sync items must
 * be submitted through the v1 orders API — buildStoreOrderRequest picks the
 * API version per store batch and converts shapes accordingly.
 */
export type PrintfulOrderItem =
  | { source: "sync_variant"; sync_variant_id: number; quantity: number }
  | {
      source: "catalog";
      catalog_variant_id: number;
      quantity: number;
      placements: { placement: string; technique: string; layers: PrintfulOrderLayer[] }[];
      product_options?: { name: string; value: string | boolean | number }[];
    };

export function isPrintfulConfirmationAllowed(input: {
  fulfillmentMode: string | undefined;
  allowConfirm: string | undefined;
  liveMode: string | undefined;
}): boolean {
  return input.fulfillmentMode === "auto" && input.allowConfirm === "true" && input.liveMode === "true";
}

export function shouldRetryPrintfulConfirmation(input: {
  confirmationAllowed: boolean;
  printfulOrderId?: string | null;
  status: string;
}): boolean {
  return input.confirmationAllowed && Boolean(input.printfulOrderId) &&
    ["draft_created", "confirmation_failed"].includes(input.status);
}

/** A catalog-source item is orderable only when every placement carries a hosted file URL. */
function buildCatalogOrderItem(item: FulfillmentSourceItem): PrintfulOrderItem | null {
  if (!item.printfulCatalogVariantId) return null;
  const placements = item.printfulPlacements ?? [];
  if (placements.length === 0) return null;
  if (!placements.every((placement) => placement.fileUrl)) return null;
  return {
    source: "catalog",
    catalog_variant_id: item.printfulCatalogVariantId,
    quantity: item.quantity,
    placements: placements.map((placement) => ({
      placement: placement.placement,
      technique: placement.technique,
      layers: [{
        type: "file" as const,
        url: resolvePrintfulAssetUrl(placement.fileUrl!),
        ...(placement.position
          ? { position: {
              width: placement.position.width, height: placement.position.height,
              top: placement.position.top, left: placement.position.left,
            } }
          : {}),
      }],
    })),
    ...(item.printfulProductOptions?.length ? { product_options: item.printfulProductOptions } : {}),
  };
}

/** v1 order item shapes (sync legacy + catalog-as-files). */
type PrintfulV1OrderItem =
  | { sync_variant_id: number; quantity: number }
  | {
      variant_id: number;
      quantity: number;
      files: { type: string; url: string; position?: Record<string, number> }[];
      options?: { id: string; value: string | boolean | number }[];
    };

const V1_DPI = 150; // v1 positions are pixels at 150dpi; inches × 150

function toV1Item(item: FulfillmentSourceItem): PrintfulV1OrderItem | null {
  if (item.printfulSyncVariantId) {
    return { sync_variant_id: item.printfulSyncVariantId, quantity: item.quantity };
  }
  if (!item.printfulCatalogVariantId) return null;
  const placements = item.printfulPlacements ?? [];
  if (placements.length === 0 || !placements.every((p) => p.fileUrl)) return null;
  return {
    variant_id: item.printfulCatalogVariantId,
    quantity: item.quantity,
    files: placements.map((p) => ({
      type: p.placement,
      url: resolvePrintfulAssetUrl(p.fileUrl!),
      // Position is only expressible in v1 when the area size is known.
      ...(p.position?.areaWidth && p.position?.areaHeight
        ? { position: {
            area_width: Math.round(p.position.areaWidth * V1_DPI),
            area_height: Math.round(p.position.areaHeight * V1_DPI),
            width: Math.round(p.position.width * V1_DPI),
            height: Math.round(p.position.height * V1_DPI),
            top: Math.round(p.position.top * V1_DPI),
            left: Math.round(p.position.left * V1_DPI),
          } }
        : {}),
    })),
    ...(item.printfulProductOptions?.length
      ? { options: item.printfulProductOptions.map((o) => ({ id: o.name, value: o.value })) }
      : {}),
  };
}

export interface StoreOrderRequest {
  apiVersion: "v1" | "v2";
  body: Record<string, unknown>;
}

/**
 * Build the provider order request for one store batch.
 * - catalog-only batches use the v2 orders API (placements shape, proven live)
 * - any batch containing a sync item uses the v1 orders API, which still
 *   accepts sync_variant_id items and carries catalog items as variant files
 *   (mixed draft verified against the live store 2026-07-14)
 */
export function buildStoreOrderRequest(
  items: FulfillmentSourceItem[],
  recipient: Record<string, unknown>
): StoreOrderRequest | null {
  const hasSync = items.some((item) => item.printfulSyncVariantId);
  if (!hasSync) {
    const orderItems = items.map(buildCatalogOrderItem).filter(Boolean);
    if (orderItems.length === 0) return null;
    return { apiVersion: "v2", body: { recipient, order_items: orderItems } };
  }
  const v1Items = items.map(toV1Item).filter(Boolean);
  if (v1Items.length === 0) return null;
  return { apiVersion: "v1", body: { recipient, items: v1Items } };
}

export function groupItemsByPrintfulStore(
  items: FulfillmentSourceItem[],
  defaultStore?: number
): Map<number, PrintfulOrderItem[]> {
  const groups = new Map<number, PrintfulOrderItem[]>();
  for (const item of items) {
    const storeId = item.printfulStoreId || defaultStore;
    if (!storeId) continue;
    let orderItem: PrintfulOrderItem | null = null;
    if (item.printfulSyncVariantId) {
      orderItem = {
        source: "sync_variant",
        sync_variant_id: item.printfulSyncVariantId,
        quantity: item.quantity,
      };
    } else {
      orderItem = buildCatalogOrderItem(item);
    }
    if (!orderItem) continue;
    const group = groups.get(storeId) ?? [];
    group.push(orderItem);
    groups.set(storeId, group);
  }
  return groups;
}

/** Group fulfillable SOURCE items by owning store (the order request is built per batch). */
export function groupSourceItemsByPrintfulStore(
  items: FulfillmentSourceItem[],
  defaultStore?: number
): Map<number, FulfillmentSourceItem[]> {
  const groups = new Map<number, FulfillmentSourceItem[]>();
  for (const item of items) {
    const storeId = item.printfulStoreId || defaultStore;
    if (!storeId) continue;
    const fulfillable = item.printfulSyncVariantId ? true : buildCatalogOrderItem(item) !== null;
    if (!fulfillable) continue;
    const group = groups.get(storeId) ?? [];
    group.push(item);
    groups.set(storeId, group);
  }
  return groups;
}

/**
 * APLIIQ's "New" state means the print shop has the order in its queue and
 * nobody has touched a garment yet. It used to collapse straight into
 * `confirmed`, which tells the shopper "In production" about a blank still on
 * the shelf. It gets its own state so `confirmed` can mean what it says:
 * preparing to release, ready to release, in production, ready to ship.
 */
export const ACCEPTED_UNPROCESSED_STATUS = "accepted_unprocessed";

/**
 * Part of the order was cancelled while the rest kept moving. This used to fall
 * through to `partially_shipped`, which erased the cancelled portion entirely —
 * and a cancelled line is money owed back to the shopper, so it must never be
 * summarised away by the lines that are still shipping.
 */
export const PARTIALLY_CANCELED_STATUS = "partially_canceled";

/**
 * The terminal resolution of PARTIALLY_CANCELED_STATUS: the cancelled portion
 * is settled and every line that survived the cancellation has shipped.
 *
 * Without it, PARTIALLY_CANCELED_STATUS was a permanent latch. The surviving
 * lines shipped, a shipment row and an order_shipped email went out, and the
 * only status the shopper could actually read still said "Partially canceled" —
 * forever, because nothing downstream of a partial cancel could ever move the
 * order again. This state is still cancellation-bearing (the refund owed is
 * never summarised away by the lines that shipped) but it is DONE, so the
 * shopper copy and the ops queue can both tell the truth.
 */
export const PARTIALLY_CANCELED_SHIPPED_STATUS = "partially_canceled_shipped";

/**
 * Order-level states that carry a cancelled portion. Any of these present in a
 * batch means the order can never be summarised as plain shipped/partially
 * shipped: that is how a cancelled line got erased with no refund and no flag.
 */
const CANCELLATION_BEARING_STATUSES: ReadonlySet<string> = new Set([
  "canceled", PARTIALLY_CANCELED_STATUS, PARTIALLY_CANCELED_SHIPPED_STATUS,
]);

/**
 * Row states that mean "whatever survived here is out the door". A row that is
 * itself partially-canceled-shipped counts: its own surviving lines shipped.
 */
const TERMINAL_SURVIVING_STATUSES: ReadonlySet<string> = new Set([
  "shipped", "delivered", PARTIALLY_CANCELED_SHIPPED_STATUS,
]);

/**
 * Shopper-facing copy for an order-level fulfillment status. Single source of
 * truth: the same map is read by the fulfillment engine and by the APLIIQ
 * webhook reconciler, so a new status cannot gain honest copy in one path and
 * silently fall back to "Payment confirmed" in the other.
 */
export function customerStatusFor(status: string): string {
  switch (status) {
    case "draft_created": return "Preparing your order";
    case ACCEPTED_UNPROCESSED_STATUS: return "Received by our print shop";
    case "confirmed": return "In production";
    case "partially_shipped": return "Partially shipped";
    case "shipped": return "Shipped";
    case "delivered": return "Delivered";
    case PARTIALLY_CANCELED_STATUS: return "Partially canceled";
    // Both halves of the truth, in the order the shopper cares about: their
    // surviving items are on the way, and part of the order is not coming.
    // "Partially canceled" alone hid a shipment they had already been emailed
    // about; "Shipped" alone would hide money we still owe them.
    case PARTIALLY_CANCELED_SHIPPED_STATUS: return "Shipped (part of your order was canceled)";
    case "canceled": return "Canceled";
    case "manual_review": return "Action needed";
    default: return "Payment confirmed";
  }
}

export function aggregateFulfillmentStatus(statuses: string[]): string {
  if (statuses.length === 0) return "not_started";
  if (statuses.some((status) => ["manual_review", "confirmation_failed", "failed", "on_hold"].includes(status))) {
    return "manual_review";
  }
  if (statuses.every((status) => status === "canceled")) return "canceled";
  // A cancellation mixed with anything else is reported BEFORE the shipped
  // arithmetic below. ["canceled", "shipped"] used to return partially_shipped,
  // which is how a cancelled line got erased with no refund and no flag.
  //
  // A provider row that is ITSELF partially canceled carries the same meaning
  // and has to be honoured here too: there is exactly one APLIIQ fulfillment
  // row per order, so a subset cancel has nowhere else to live, and without
  // this clause a lone partially_canceled row fell through every branch below
  // and aggregated to "queued" — customer copy "Payment confirmed".
  //
  // Cancellation-bearing is not the same as unfinished. Once every batch that
  // is NOT wholly cancelled has shipped, the order is over and has to say so:
  // holding it at PARTIALLY_CANCELED_STATUS left the shopper reading "Partially
  // canceled" after the surviving items had been shipped and emailed to them,
  // with no later event able to move it.
  if (statuses.some((status) => CANCELLATION_BEARING_STATUSES.has(status))) {
    const surviving = statuses.filter((status) => status !== "canceled");
    return surviving.every((status) => TERMINAL_SURVIVING_STATUSES.has(status))
      ? PARTIALLY_CANCELED_SHIPPED_STATUS
      : PARTIALLY_CANCELED_STATUS;
  }

  const shipped = statuses.filter((status) => ["shipped", "delivered"].includes(status)).length;
  if (shipped === statuses.length) {
    return statuses.every((status) => status === "delivered") ? "delivered" : "shipped";
  }
  if (shipped > 0) return "partially_shipped";
  if (statuses.every((status) => status === "confirmed")) return "confirmed";
  // Least-progressed provider batch wins: one batch APLIIQ has not started yet
  // holds the whole order back from claiming production.
  if (statuses.every((status) => [ACCEPTED_UNPROCESSED_STATUS, "confirmed"].includes(status))) {
    return ACCEPTED_UNPROCESSED_STATUS;
  }
  if (statuses.every((status) => ["draft_created", ACCEPTED_UNPROCESSED_STATUS, "confirmed"].includes(status))) return "draft_created";
  if (statuses.some((status) => status === "draft_creating")) return "draft_creating";
  return "queued";
}

/**
 * Index provider fulfillment rows by their owning order for the ops table. The
 * provider order id is the only identifier APLIIQ support will act on, so it
 * has to be renderable, not SQL-only.
 */
export function groupFulfillmentsByOrder<T extends { orderId: number | null }>(
  rows: readonly T[]
): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    if (row.orderId === null) continue;
    const bucket = grouped.get(row.orderId) ?? [];
    bucket.push(row);
    grouped.set(row.orderId, bucket);
  }
  return grouped;
}
