export interface FulfillmentSourcePlacement {
  placement: string;
  technique: string;
  fileUrl?: string;
  fileId?: number;
  /** Print position in inches (from the design spec or a sync-variant snapshot). */
  position?: { width: number; height: number; top: number; left: number };
}

export interface FulfillmentSourceItem {
  printfulStoreId?: number;
  printfulSyncVariantId?: number;
  printfulCatalogVariantId?: number;
  printfulPlacements?: FulfillmentSourcePlacement[];
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
 */
export type PrintfulOrderItem =
  | { source: "sync_variant"; sync_variant_id: number; quantity: number }
  | {
      source: "catalog";
      catalog_variant_id: number;
      quantity: number;
      placements: { placement: string; technique: string; layers: PrintfulOrderLayer[] }[];
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
        ...(placement.position ? { position: placement.position } : {}),
      }],
    })),
  };
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
