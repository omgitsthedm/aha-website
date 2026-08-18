import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Editorial imagery registry — every non-product image slot on the storefront.
 * Source of truth: data/brand-imagery.json. Product imagery lives in Square.
 *
 * `placeholder: true` marks an image standing in for the shoot; swapping is a
 * file replacement (same aspect) and flipping the flag. Nothing renders the
 * flag to customers — it is an operator signal for the launch swap.
 */
export interface EditorialImage {
  src: string;
  alt: string;
  caption?: string;
  productSlug?: string;
  year?: string;
  aspect?: string;
  placeholder: boolean;
  source: string;
  swap?: string;
}

export interface BrandImagery {
  hero: EditorialImage;
  maker: EditorialImage;
  categories: Record<string, EditorialImage>;
  lookbook: EditorialImage[];
  signature: EditorialImage[];
  archive: EditorialImage[];
}

let cache: BrandImagery | null = null;

export function loadBrandImagery(): BrandImagery {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "brand-imagery.json");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as BrandImagery & { _note?: string };
  delete parsed._note;
  cache = parsed;
  return parsed;
}
