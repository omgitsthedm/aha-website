import { squareRequest } from "./client";
import type { Product, Collection } from "@/lib/utils/types";
import { mapSquareItemToProduct, mapSquareCategoryToCollection } from "@/lib/utils/mappers";
import { loadProducts, loadProductMap } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { buildPreviewCollections, buildPreviewProducts } from "@/lib/data/preview-catalog";

function previewCatalogFallbackAllowed(): boolean {
  return process.env.AHA_PREVIEW_CATALOG === "true";
}

const LEGACY_COLLECTION_ID = "57JPU5ZDHXGWVPRQQZMWVR5Q";

// David-approved 2026-07-13: these Black Sheep / Sheep Min products are
// active, mapped, margin-passing, and have verified mockups. They surface
// even though Square still files them in the legacy collection. Everything
// else in that collection stays hidden.
const APPROVED_LEGACY_SLUGS = new Set([
  "sheep-min-grey-unisex-hoodie",
  "sheep-min-black-unisex-hoodie",
  "sheep-min-maroon-unisex-hoodie",
  "sheep-min-dark-tan-unisex-hoodie",
  "black-sheep-bone-unisex-premium-sweatshirt",
  "black-sheep-mint-unisex-premium-sweatshirt",
  "black-sheep-can-cooler",
  // 2026-07-13 batch two — repriced to margin floor and activated with
  // David's "use suggested" approval:
  "zebra-unisex-knitted-cardigan",
  "dots-unisex-knitted-crewneck-sweater",
  "royal-black-unisex-hoodie",
  "nys-ecto-black-unisex-hoodie",
  "avenue-b-new-york-grey-unisex-hoodie",
  "dont-fuck-fascists-unisex-hoodie",
  "super-bros-black-short-sleeve-t-shirt",
  "keano",
  "nys-ecto-black-short-sleeve-t-shirt",
  "link-s-lawn-service-white-unisex-short-sleeve-t-shirt",
  "dont-fuck-fascists-sweatshirt",
  "yellow-reversible-bucket-hat",
  "counting-sheep-tote-bag-large-with-pocket",
  "dont-fuck-fascists-shirt",
  "library-tote-bag",
  "black-sheep-black-grey-or-white-comfy-socks",
  "counting-sheep-tote-bag-regular",
  "hope-and-tomorrow-dark-grey-cuffed-beanie",
  "hope-and-tomorrow-red-cuffed-beanie",
  "aha-wall-crossbody-bag",
  "counting-sheep-crossbody-bag",
]);

function isCurrentStorefrontProduct(product: Product): boolean {
  if (APPROVED_LEGACY_SLUGS.has(product.slug)) return true;
  return !product.collectionIds.includes(LEGACY_COLLECTION_ID);
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

// The Square catalog fetch is a POST (`/catalog/search`), which Next's fetch
// data-cache never stores — so the `revalidate` hint on the fetch is a no-op and
// every uncached render re-paginated the whole catalog (the bulk of PDP TTFB).
// unstable_cache memoizes the *return value* across requests for 300s, matching
// the ISR staleness already in effect. Prices stay display-only; the charge is
// always re-priced live at /api/create-payment, so this adds no pricing risk.
const fetchAllProductsCached = unstable_cache(
  async function fetchAllProductsFromSquare(): Promise<Product[]> {
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
  const products = allItems
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

  // Enrich Square-mapped products with AHA taxonomy from the internal manifest.
  const productMap = loadProductMap();
    return products.map((product) => {
      const ahaProduct = productMap.get(product.slug);
      if (!ahaProduct) return product;
      return {
        ...product,
        category: ahaProduct.category,
        gender: ahaProduct.gender,
      };
    });
  },
  ["square-catalog-all-products"],
  { revalidate: 300, tags: ["square-catalog"] }
);

export const getAllProducts = cache(async function getAllProducts(): Promise<Product[]> {
  if (!process.env.SQUARE_ACCESS_TOKEN && previewCatalogFallbackAllowed()) {
    return buildPreviewProducts().filter(isCurrentStorefrontProduct);
  }
  return fetchAllProductsCached();
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
