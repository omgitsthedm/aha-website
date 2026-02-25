import type { Product, ProductVariation, Collection } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function mapSquareItemToProduct(
  item: any,
  imageMap: Map<string, string>
): Product {
  const itemData = item.item_data || {};
  const variations: ProductVariation[] = (itemData.variations || []).map(
    (v: any, i: number) => {
      const priceMoney = v.item_variation_data?.price_money;
      const price = priceMoney?.amount || 0;
      return {
        id: v.id,
        name: v.item_variation_data?.name || "Default",
        sku: v.item_variation_data?.sku,
        price,
        priceFormatted: formatMoney(price, priceMoney?.currency),
        ordinal: v.item_variation_data?.ordinal ?? i,
      };
    }
  );

  // Get price from first variation
  const firstVariation = variations[0];
  const price = firstVariation?.price || 0;

  // Build image URLs
  const imageIds: string[] = itemData.image_ids || [];
  const images = imageIds
    .map((id: string) => imageMap.get(id))
    .filter(Boolean) as string[];

  // Get collection IDs from categories
  const collectionIds: string[] = (itemData.categories || []).map(
    (cat: any) => cat.id
  );

  return {
    id: item.id,
    slug: slugify(itemData.name || item.id),
    name: itemData.name || "Untitled",
    description: itemData.description_html || itemData.description || "",
    price,
    priceFormatted: formatMoney(price),
    currency: "USD",
    images,
    collectionIds,
    collectionNames: [],
    variations: variations.sort((a, b) => a.ordinal - b.ordinal),
    categoryId: itemData.category_id,
  };
}

export function mapSquareCategoryToCollection(
  obj: any,
  meta: { accent: string; description: string }
): Collection {
  const categoryData = obj.category_data || {};
  return {
    id: obj.id,
    slug: slugify(categoryData.name || obj.id),
    name: categoryData.name || "Untitled",
    description: meta.description,
    accent: meta.accent,
  };
}
