import { unstable_cache } from "next/cache";
import { printfulRequest } from "./client";
import { getSizeGuide } from "./catalog";

export interface SizeTable {
  unit: string;
  sizes: string[]; // column headers, e.g. ["S","M","L","XL"]
  rows: { label: string; values: string[] }[]; // e.g. { label: "Chest width", values: ["18","20",...] }
}

/**
 * Real garment measurements for a product, resolved from a representative
 * Printful catalog variant: variant → catalog product → size guide. Cached 24h.
 * Fails open to null so a Printful hiccup (or a missing token locally) never
 * breaks the PDP — the size modal just falls back to the fit description.
 */
async function fetchSizeTable(catalogVariantId: number): Promise<SizeTable | null> {
  try {
    const variant = await printfulRequest<{ data?: { catalog_product_id?: number } }>(
      `/catalog-variants/${catalogVariantId}`
    );
    const productId = variant.data?.catalog_product_id;
    if (!productId) return null;

    const guide = await getSizeGuide(productId);
    if (!guide?.measurements?.length) return null;

    const sizeSet = new Set<string>();
    for (const m of guide.measurements) for (const v of m.values) sizeSet.add(v.size);
    const sizes = Array.from(sizeSet);
    if (!sizes.length) return null;

    const rows = guide.measurements
      .map((m) => ({
        label: m.type_label,
        values: sizes.map((s) => {
          const v = m.values.find((x) => x.size === s);
          if (!v) return "—";
          if (v.value) return v.value;
          if (v.min_value && v.max_value) return `${v.min_value}–${v.max_value}`;
          return "—";
        }),
      }))
      .filter((r) => r.values.some((v) => v !== "—"));

    if (!rows.length) return null;
    return { unit: guide.unit || "inches", sizes, rows };
  } catch {
    return null;
  }
}

export function getSizeTable(catalogVariantId: number): Promise<SizeTable | null> {
  return unstable_cache(
    () => fetchSizeTable(catalogVariantId),
    [`printful-size-table-${catalogVariantId}`],
    { revalidate: 86_400, tags: ["printful-size-table"] }
  )();
}
