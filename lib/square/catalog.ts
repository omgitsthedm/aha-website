import { squareRequest } from "./client";
import type { Product, Collection } from "@/lib/utils/types";
import { mapSquareItemToProduct, mapSquareCategoryToCollection } from "@/lib/utils/mappers";
import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { cache } from "react";
import { buildPreviewCollections, buildPreviewProducts } from "@/lib/data/preview-catalog";

function previewCatalogFallbackAllowed(): boolean {
  return process.env.AHA_PREVIEW_CATALOG === "true";
}

const LEGACY_COLLECTION_ID = "57JPU5ZDHXGWVPRQQZMWVR5Q";
const LEGACY_PRODUCT_NAME = /black sheep|counting sheep|pink sheep|sheep min/i;

function isCurrentStorefrontProduct(product: Product): boolean {
  return !product.collectionIds.includes(LEGACY_COLLECTION_ID) && !LEGACY_PRODUCT_NAME.test(product.name);
}

interface SquareCatalogResponse {
  objects?: any[];
  cursor?: string;
  related_objects?: any[];
}

interface SquareSearchResponse {
  objects?: any[];
  cursor?: string;
  related_objects?: any[];
}

interface EligibleSquareItem {
  slug: string;
  variationIds: Set<string>;
}

/** Exact internal commerce registry used to keep unmapped or unprofitable Square rows off-sale. */
export function buildEligibleSquareIndex(): Map<string, EligibleSquareItem> {
  const index = new Map<string, EligibleSquareItem>();
  for (const product of loadProducts()) {
    for (const variant of product.variants) {
      if (!variant.squareCatalogObjectId || !variant.squareVariationId) continue;
      if (!checkVariantPurchasable(product, variant).ok) continue;
      const entry = index.get(variant.squareCatalogObjectId) ?? {
        slug: product.slug,
        variationIds: new Set<string>(),
      };
      entry.variationIds.add(variant.squareVariationId);
      index.set(variant.squareCatalogObjectId, entry);
    }
  }
  return index;
}

export const getAllProducts = cache(async function getAllProducts(): Promise<Product[]> {
  if (!process.env.SQUARE_ACCESS_TOKEN && previewCatalogFallbackAllowed()) {
    return buildPreviewProducts().filter(isCurrentStorefrontProduct);
  }
  let allItems: any[] = [];
  let allRelated: any[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      object_types: ["ITEM"],
      include_related_objects: true,
      // Square's full 100-item response exceeds Next's 2 MB data-cache entry limit. Smaller
      // pages remain cacheable and prevent every route render from refetching the entire catalog.
      limit: 40,
    };
    if (cursor) body.cursor = cursor;

    const res = await squareRequest<SquareSearchResponse>(
      "/catalog/search",
      { method: "POST", body }
    );

    if (res.objects) allItems.push(...res.objects);
    if (res.related_objects) allRelated.push(...res.related_objects);
    cursor = res.cursor;
  } while (cursor);

  // Build image map from related objects
  const imageMap = new Map<string, string>();
  for (const obj of allRelated) {
    if (obj.type === "IMAGE" && obj.image_data?.url) {
      imageMap.set(obj.id, obj.image_data.url);
    }
  }

  const eligible = buildEligibleSquareIndex();
  return allItems
    .filter((item) => {
      if (item.is_deleted) return false;
      // Filter out service items (Billable Hour, Discount, etc.)
      const productType = item.item_data?.product_type;
      if (productType === "LEGACY_SQUARE_ONLINE_SERVICE") return false;
      // Only include items that have at least one image
      const imageIds = item.item_data?.image_ids || [];
      const hasImage = imageIds.some((id: string) => imageMap.has(id));
      if (!hasImage) return false;
      // Filter out items with zero price
      const variations = item.item_data?.variations || [];
      const hasPrice = variations.some(
        (v: any) => (v.item_variation_data?.price_money?.amount || 0) > 0
      );
      if (!hasPrice) return false;
      return eligible.has(item.id);
    })
    .map((item) => {
      const registry = eligible.get(item.id)!;
      const filtered = {
        ...item,
        item_data: {
          ...item.item_data,
          variations: (item.item_data?.variations || []).filter((variation: any) =>
            registry.variationIds.has(variation.id)
          ),
        },
      };
      return mapSquareItemToProduct(filtered, imageMap, registry.slug);
    })
    .filter(isCurrentStorefrontProduct);
});

export async function getProduct(slug: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((p) => p.slug === slug) || null;
}

export const getAllCollections = cache(async function getAllCollections(): Promise<Collection[]> {
  if (!process.env.SQUARE_ACCESS_TOKEN && previewCatalogFallbackAllowed()) {
    return buildPreviewCollections();
  }
  const res = await squareRequest<SquareCatalogResponse>(
    "/catalog/search",
    {
      method: "POST",
      body: {
        object_types: ["CATEGORY"],
        include_related_objects: true,
      },
    }
  );

  if (!res.objects) return [];

  // Collection IDs and their metadata
  const collectionMeta: Record<string, { accent: string; description: string }> = {
    "JPSOS6BFOQPITXEJFYJWYIXZ": { accent: "cream", description: "Self-rule in print. Graphics for people who do not need a throne." },
    "SZ6M4QZCTTSPNRKY5VS3JDAW": { accent: "blue", description: "Products grouped in the current After Hours collection." },
    "OCWUVMJQMVGJZ6FT62K5HVP4": { accent: "cream", description: "City memory without the souvenir-shop treatment." },
    "BRNXSU4IF5U3AWAYYYP3TTHU": { accent: "sunrise", description: "Optimism with its eyes open. Wear the part that keeps going." },
    "ARX3DXVEX6CJOIBNNYKNX6MU": { accent: "sunrise", description: "Good nerve, bright color, and a reason to keep moving." },
    "QGLIV54AJSOYXZOX5IBWQVPM": { accent: "cream", description: "Core products intended for repeat wear." },
    "FAIJ7SE5DJP25N26ND3L76SU": { accent: "mint", description: "The latest pieces to clear the press and enter the active catalog." },
  };

  return res.objects
    .filter((obj: any) => !obj.is_deleted && collectionMeta[obj.id])
    .map((obj: any) => mapSquareCategoryToCollection(obj, collectionMeta[obj.id]));
});

export async function getProductsByCollection(collectionId: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((p) => p.collectionIds.includes(collectionId));
}
