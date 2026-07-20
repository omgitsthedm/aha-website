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
        url: placement.fileUrl!,
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
      url: p.fileUrl!,
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

export function aggregateFulfillmentStatus(statuses: string[]): string {
  if (statuses.length === 0) return "not_started";
  if (statuses.some((status) => ["manual_review", "confirmation_failed", "failed", "on_hold"].includes(status))) {
    return "manual_review";
  }
  if (statuses.every((status) => status === "canceled")) return "canceled";

  const shipped = statuses.filter((status) => ["shipped", "delivered"].includes(status)).length;
  if (shipped === statuses.length) {
    return statuses.every((status) => status === "delivered") ? "delivered" : "shipped";
  }
  if (shipped > 0) return "partially_shipped";
  if (statuses.every((status) => status === "confirmed")) return "confirmed";
  if (statuses.every((status) => ["draft_created", "confirmed"].includes(status))) return "draft_created";
  if (statuses.some((status) => status === "draft_creating")) return "draft_creating";
  return "queued";
}
