import { unstable_cache } from "next/cache";
import { printfulRequest } from "./client";

export interface SizeTable {
  unit: string;
  sizes: string[]; // column headers, e.g. ["S","M","L","XL"]
  rows: { label: string; values: string[] }[]; // e.g. { label: "Chest width", values: ["18","20",...] }
}

interface PrintfulMeasurement {
  type_label: string;
  values: { size: string; value?: string; min_value?: string; max_value?: string }[];
}
interface PrintfulSizeTable {
  type?: string;
  unit?: string;
  measurements?: PrintfulMeasurement[];
}

/**
 * Real garment measurements for a product, resolved from a representative
 * Printful catalog variant: variant → catalog product → /sizes → the
 * "product_measure" (garment, laid flat) table. Cached 24h; fails open to null
 * so a Printful hiccup (or a missing token locally) never breaks the PDP.
 */
async function fetchSizeTable(catalogVariantId: number): Promise<SizeTable | null> {
  try {
    const variant = await printfulRequest<{ data?: { catalog_product_id?: number } }>(
      `/catalog-variants/${catalogVariantId}`
    );
    const productId = variant.data?.catalog_product_id;
    if (!productId) return null;

    const res = await printfulRequest<{ data?: { available_sizes?: string[]; size_tables?: PrintfulSizeTable[] } }>(
      `/catalog-products/${productId}/sizes`
    );
    const data = res.data;
    const tables = data?.size_tables;
    if (!Array.isArray(tables) || !tables.length) return null;

    // Prefer the garment measurements ("product_measure"); else any with data.
    const table =
      tables.find((t) => t.type === "product_measure" && t.measurements?.length) ??
      tables.find((t) => (t.measurements?.length ?? 0) > 0);
    if (!table?.measurements?.length) return null;

    const sizeSet = new Set<string>();
    for (const m of table.measurements) for (const v of m.values) sizeSet.add(v.size);
    const sizes =
      data?.available_sizes?.length ? data.available_sizes.filter((s) => sizeSet.has(s)) : Array.from(sizeSet);
    if (!sizes.length) return null;

    const rows = table.measurements
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
    return { unit: table.unit || "inches", sizes, rows };
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
