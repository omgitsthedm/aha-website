import type { Product } from "@/lib/utils/types";
import { absolutizeImage } from "@/lib/utils/image-helpers";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

interface CollectionJsonLdProps {
  name: string;
  /** canonical path of the collection, e.g. "/shop" or "/men/t-shirts" */
  path: string;
  products: Product[];
}

/**
 * ItemList structured data for collection/category pages (doctrine requirement).
 * Lists products in display order with their canonical URLs; JSON.stringify
 * escapes all values, preventing injection.
 */
export function CollectionJsonLd({ name, path, products }: CollectionJsonLdProps) {
  if (products.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: `${BASE_URL}${path}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 60).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${BASE_URL}/product/${product.slug}`,
      name: product.name,
      ...(product.images[0] && { image: absolutizeImage(product.images[0], BASE_URL) }),
    })),
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
