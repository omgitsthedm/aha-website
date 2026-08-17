import type { RevalidatedItem } from "@/lib/commerce/orders";

export type FulfillmentProvider = "printful" | "apliiq";

export interface ProviderFulfillmentGroups {
  printful: RevalidatedItem[];
  apliiq: RevalidatedItem[];
}

/**
 * Group the order's purchase-time line snapshots. This deliberately accepts
 * the persisted/revalidated line representation rather than looking at the
 * current catalog or provider map: a paid order must retain its original
 * fulfillment owner if a future catalog edit changes the live default.
 */
export function groupItemsByFulfillmentProvider(
  items: readonly RevalidatedItem[]
): ProviderFulfillmentGroups {
  const groups: ProviderFulfillmentGroups = { printful: [], apliiq: [] };
  for (const item of items) {
    const provider = item.fulfillmentProvider ?? "printful";
    if (provider !== "printful" && provider !== "apliiq") {
      throw new Error(`Unsupported fulfillment provider on purchase snapshot: ${String(provider)}.`);
    }
    groups[provider].push(item);
  }
  return groups;
}
