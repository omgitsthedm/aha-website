import type { Product } from "@/lib/utils/types";

/**
 * Open Graph product tags (og:type=product + product:*). Meta's Commerce
 * Manager "website" catalog source and link previews read these with the
 * `property` attribute, which Next's typed metadata cannot emit (its
 * `other` map renders `name=`). React hoists these <meta> tags into <head>.
 * Price is the base variation price; "in stock" is honest for made-to-order.
 */
export function ProductOpenGraph({ product }: { product: Product }) {
  const sku = product.variations[0]?.sku?.replace(/-[A-Z0-9]+$/, "") ?? product.slug;
  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={(product.price / 100).toFixed(2)} />
      <meta property="product:price:currency" content={product.currency || "USD"} />
      <meta property="product:availability" content="in stock" />
      <meta property="product:condition" content="new" />
      <meta property="product:brand" content="After Hours Agenda" />
      <meta property="product:retailer_item_id" content={sku} />
    </>
  );
}
