// Loads the internal product dataset: reads data/product-manifest.json and merges external
// IDs from data/square-map.json + data/printful-v2-map.json by ahaVariantId. Works in Node
// scripts and Next server components (repo-root cwd). See §13/§24.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AhaProduct, AhaVariant, SizeGuide } from "@/lib/types/product";

const DATA_DIR = join(process.cwd(), "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
}

interface SquareMapEntry {
  squareCatalogObjectId?: string;
  squareVariationId?: string;
  squareLocationId?: string;
}
interface PrintfulMapEntry {
  printfulCatalogProductId?: number;
  printfulCatalogVariantId?: number;
  printfulSyncVariantId?: number;
  printfulStoreId?: number;
  printfulRegionAvailability?: string[];
  printfulPlacements?: AhaVariant["printfulPlacements"];
  printfulProductOptions?: AhaVariant["printfulProductOptions"];
  printfulTechnique?: AhaVariant["printfulTechnique"];
  printfulSizeGuideReference?: string;
  costEstimate?: number;
}

/** Load products with Square + Printful maps merged in by ahaVariantId. */
export function loadProducts(): AhaProduct[] {
  const manifest = readJson<{ products: AhaProduct[] }>("product-manifest.json");
  const squareMap = readJson<{ map: Record<string, SquareMapEntry> }>("square-map.json").map;
  const printfulMap = readJson<{ map: Record<string, PrintfulMapEntry> }>("printful-v2-map.json").map;

  return manifest.products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      ...(squareMap[variant.ahaVariantId] ?? {}),
      ...(printfulMap[variant.ahaVariantId] ?? {}),
    })),
  }));
}

export function loadSizeGuides(): SizeGuide[] {
  return readJson<{ sizeGuides: SizeGuide[] }>("size-guides.json").sizeGuides;
}

export function getProductBySlug(slug: string): AhaProduct | undefined {
  return loadProducts().find((p) => p.slug === slug);
}

/** Slug-lookup map for storefront enrichment (e.g., gender/category from manifest). */
export function loadProductMap(): Map<string, AhaProduct> {
  return new Map(loadProducts().map((product) => [product.slug, product]));
}
