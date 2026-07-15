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

/** TEMP self-diagnosis: surfaces which step failed. Remove after the mapping is fixed. */
export async function debugSizeTable(catalogVariantId: number): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { catalogVariantId };
  try {
    const variant = await printfulRequest<Record<string, unknown>>(`/catalog-variants/${catalogVariantId}`);
    out.variantKeys = variant && typeof variant === "object" ? Object.keys(variant) : typeof variant;
    const data = (variant as { data?: Record<string, unknown> }).data;
    out.dataKeys = data ? Object.keys(data) : null;
    out.catalog_product_id = data?.catalog_product_id ?? null;
    const productId = data?.catalog_product_id;
    if (typeof productId === "number") {
      const raw = await printfulRequest<Record<string, unknown>>(`/catalog-products/${productId}/sizes`);
      out.sizesTopKeys = raw && typeof raw === "object" ? Object.keys(raw) : typeof raw;
      const rawData = (raw as { data?: unknown }).data;
      out.sizesDataType = Array.isArray(rawData) ? `array(${rawData.length})` : typeof rawData;
      const sample = Array.isArray(rawData) ? rawData[0] : rawData;
      out.sizesSampleKeys = sample && typeof sample === "object" ? Object.keys(sample as object) : sample;
      const tables = (rawData as { size_tables?: Array<Record<string, unknown>> })?.size_tables;
      out.tables = Array.isArray(tables)
        ? tables.map((t) => ({
            type: t.type,
            unit: t.unit,
            measCount: Array.isArray(t.measurements) ? (t.measurements as unknown[]).length : 0,
            firstMeas: Array.isArray(t.measurements) ? (t.measurements as unknown[])[0] : null,
          }))
        : null;
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}
