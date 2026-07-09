// Live stock for a set of Printful catalog variant ids → { catId: inStock }.
import { getVariantInStock } from "@/lib/printful/availability";

export async function getStockByCatId(catIds: number[]): Promise<Record<number, boolean>> {
  const unique = Array.from(new Set(catIds.filter((n) => Number.isFinite(n) && n > 0)));
  const entries = await Promise.all(
    unique.map(async (id) => [id, await getVariantInStock(id)] as const)
  );
  return Object.fromEntries(entries);
}
