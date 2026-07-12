export interface FulfillmentSourceItem {
  printfulStoreId?: number;
  printfulSyncVariantId?: number;
  quantity: number;
}

export interface PrintfulOrderItem {
  source: "sync_variant";
  sync_variant_id: number;
  quantity: number;
}

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

export function groupItemsByPrintfulStore(
  items: FulfillmentSourceItem[],
  defaultStore?: number
): Map<number, PrintfulOrderItem[]> {
  const groups = new Map<number, PrintfulOrderItem[]>();
  for (const item of items) {
    if (!item.printfulSyncVariantId) continue;
    const storeId = item.printfulStoreId || defaultStore;
    if (!storeId) continue;
    const group = groups.get(storeId) ?? [];
    group.push({
      source: "sync_variant",
      sync_variant_id: item.printfulSyncVariantId,
      quantity: item.quantity,
    });
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
