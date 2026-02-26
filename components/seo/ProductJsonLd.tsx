import type { Product } from "@/lib/utils/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.netlify.app";

interface ProductJsonLdProps {
  product: Product;
}

/**
 * Renders Product structured data (JSON-LD) for SEO rich snippets.
 * The JSON is generated from our own Product type (sourced from Square catalog)
 * and serialized with JSON.stringify which safely escapes special characters,
 * preventing script injection in the JSON-LD output.
 */
export function ProductJsonLd({ product }: ProductJsonLdProps) {
  // Guard against products with no variations (would crash Math.min/max)
  if (product.variations.length === 0) return null;

  // Strip HTML tags from description (Square may include formatting)
  const cleanDescription = product.description
    .replace(/<[^>]*>/g, "")
    .slice(0, 500);

  const prices = product.variations.map((v) => v.price);
  const lowPrice = (Math.min(...prices) / 100).toFixed(2);
  const highPrice = (Math.max(...prices) / 100).toFixed(2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription,
    image: product.images,
    url: `${BASE_URL}/product/${product.slug}`,
    brand: {
      "@type": "Brand",
      name: "After Hours Agenda",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.currency || "USD",
      lowPrice,
      highPrice,
      offerCount: product.variations.length,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "After Hours Agenda",
      },
    },
  };

  // JSON.stringify safely escapes all special characters, preventing XSS
  const safeJson = JSON.stringify(jsonLd);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
