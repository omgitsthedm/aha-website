import { getAllProducts } from "@/lib/square/catalog";
import { extractVariationSize } from "@/lib/utils/variation";
import type { CartItem, Product, ProductVariation } from "@/lib/utils/types";

// Meta (Facebook/Instagram Shop) sends shoppers to
//   /checkout?products=<SKU>:<QTY>,<SKU>:<QTY>&coupon=<CODE>
// where <SKU> is the catalog retailer id from /feeds/meta (AHA-<DESIGN>-<SIZE>).
// This resolves those pairs against the live Square catalog so the hand-off can
// never sell a size or price the storefront doesn't. Docs: Commerce Manager →
// Shop → Add checkout URL.

const MAX_QUANTITY_PER_ITEM = 20; // Mirrors the cap in CartProvider.

interface ParsedEntry {
  sku: string;
  quantity: number;
}

function parseProductsParam(productsParam: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const raw of productsParam.split(",")) {
    const [skuPart, qtyPart] = raw.trim().split(":");
    const sku = (skuPart || "").trim().toUpperCase();
    if (!sku) continue;
    const parsed = Math.round(Number(qtyPart));
    const quantity = Math.min(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
      MAX_QUANTITY_PER_ITEM
    );
    entries.push({ sku, quantity });
  }
  return entries;
}

/**
 * Resolve Meta's `products` URL parameter into cart lines. Unknown or retired
 * SKUs are skipped (never thrown) so one dead item can't block the hand-off,
 * and duplicate SKUs merge under the same quantity cap the cart enforces.
 * Returns [] on any catalog failure — the checkout page then renders normally.
 */
export async function resolveMetaCheckoutItems(productsParam: string): Promise<CartItem[]> {
  const entries = parseProductsParam(productsParam);
  if (entries.length === 0) return [];
  try {
    const products = await getAllProducts();
    const bySku = new Map<string, { product: Product; variation: ProductVariation }>();
    for (const product of products) {
      for (const variation of product.variations) {
        if (variation.sku) bySku.set(variation.sku.toUpperCase(), { product, variation });
      }
    }
    const items: CartItem[] = [];
    for (const { sku, quantity } of entries) {
      const hit = bySku.get(sku);
      if (!hit) continue;
      const existing = items.find((i) => i.variationId === hit.variation.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY_PER_ITEM);
        continue;
      }
      items.push({
        productId: hit.product.id,
        slug: hit.product.slug,
        variationId: hit.variation.id,
        name: hit.product.name,
        variationName: extractVariationSize(hit.variation.name),
        price: hit.variation.price,
        priceFormatted: hit.variation.priceFormatted,
        quantity,
        image: hit.product.images[0] ?? "",
      });
    }
    return items;
  } catch (error) {
    console.error("meta checkout hand-off resolve failed", error);
    return [];
  }
}
