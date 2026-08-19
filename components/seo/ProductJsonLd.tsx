import type { Product } from "@/lib/utils/types";
import type { ReviewSummary } from "@/lib/commerce/reviews";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { extractVariationSize } from "@/lib/utils/variation";
import {
  DELIVERY_MAX_BUSINESS_DAYS_AFTER_PRODUCTION,
  DELIVERY_MIN_BUSINESS_DAYS_AFTER_PRODUCTION,
  DOMESTIC_COUNTRY,
  INTERNATIONAL_SHIPPING_CENTS,
  PRODUCTION_MAX_BUSINESS_DAYS,
  PRODUCTION_MIN_BUSINESS_DAYS,
  RETURNS_WINDOW_DAYS,
  SHIPPING_COUNTRIES,
} from "@/lib/commerce/policies";
import { absolutizeImage } from "@/lib/utils/image-helpers";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

function buildShippingDetails(currency: string) {
  return SHIPPING_COUNTRIES.map((country) => ({
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value:
        country === DOMESTIC_COUNTRY
          ? 0
          : INTERNATIONAL_SHIPPING_CENTS / 100,
      currency,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: country,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: PRODUCTION_MIN_BUSINESS_DAYS,
        maxValue: PRODUCTION_MAX_BUSINESS_DAYS,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: DELIVERY_MIN_BUSINESS_DAYS_AFTER_PRODUCTION,
        maxValue: DELIVERY_MAX_BUSINESS_DAYS_AFTER_PRODUCTION,
        unitCode: "DAY",
      },
    },
  }));
}

function buildReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: [...SHIPPING_COUNTRIES],
    returnPolicyCategory:
      "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURNS_WINDOW_DAYS,
    returnMethod: "https://schema.org/ReturnByMail",
    merchantReturnLink: `${BASE_URL}/returns`,
  };
}

interface ProductJsonLdProps {
  product: Product;
  description?: string;
  reviews?: ReviewSummary;
  /** Fabric, colours and garment type from the manifest — feeds Merchant-listing attributes. */
  enrichment?: ProductEnrichment | null;
}

/**
 * Google product category (taxonomy) per garment type — Merchant Center reads
 * `category` from structured data when it crawls the site as a feed.
 */
const GOOGLE_CATEGORY: Record<string, string> = {
  tee: "Apparel & Accessories > Clothing > Shirts & Tops",
  hoodie: "Apparel & Accessories > Clothing > Shirts & Tops",
  sweater: "Apparel & Accessories > Clothing > Shirts & Tops",
  jacket: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
  hat: "Apparel & Accessories > Clothing Accessories > Hats",
  accessory: "Apparel & Accessories > Clothing Accessories",
  sticker: "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts",
};

/** Product-level SKU: the shared prefix of the variation SKUs (`AHA-BLACK-SHEEP-TEE-M` → `AHA-BLACK-SHEEP-TEE`). */
function productSku(product: Product): string | undefined {
  const skus = product.variations.map((v) => v.sku).filter((v): v is string => Boolean(v));
  if (skus.length === 0) return undefined;
  if (skus.length === 1) return skus[0];
  const parts = skus.map((sku) => sku.split("-"));
  const common: string[] = [];
  for (let i = 0; i < parts[0].length; i += 1) {
    const segment = parts[0][i];
    if (parts.every((part) => part[i] === segment)) common.push(segment); else break;
  }
  return common.length > 0 ? common.join("-") : undefined;
}

/**
 * Renders Product structured data (JSON-LD) for SEO rich snippets.
 * The JSON is generated from our own Product type (sourced from Square catalog)
 * and serialized with JSON.stringify which safely escapes special characters,
 * preventing script injection in the JSON-LD output.
 */
export function ProductJsonLd({ product, description, reviews, enrichment }: ProductJsonLdProps) {
  // Guard against products with no variations (would crash Math.min/max)
  if (product.variations.length === 0) return null;

  // Strip HTML tags from description (Square may include formatting)
  const cleanDescription = (description || product.description)
    .replace(/<[^>]*>/g, "")
    .slice(0, 500);

  const offerCurrency = product.currency || "USD";
  const shippingDetails = buildShippingDetails(offerCurrency);
  const returnPolicy = buildReturnPolicy();

  const sku = productSku(product);
  const colors = enrichment?.colors ?? [];
  const category = GOOGLE_CATEGORY[enrichment?.productType ?? ""];
  const sizes = product.variations.map((variation) => extractVariationSize(variation.name)).filter((size): size is string => Boolean(size));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription,
    image: product.images.map((src) => absolutizeImage(src, BASE_URL)),
    url: `${BASE_URL}/product/${product.slug}`,
    ...(sku ? { sku, productID: sku } : {}),
    brand: {
      "@type": "Brand",
      name: "After Hours Agenda",
    },
    // Merchant-listing attributes. Only truthful, manifest-backed values: no
    // GTIN (made-to-order apparel has none), no fabricated ratings.
    ...(colors.length > 0 ? { color: colors.join(", ") } : {}),
    ...(enrichment?.fabricDescription ? { material: enrichment.fabricDescription } : {}),
    ...(category ? { category } : {}),
    ...(sizes.length > 0 ? { size: sizes } : {}),
    itemCondition: "https://schema.org/NewCondition",
    audience: { "@type": "PeopleAudience", suggestedGender: "unisex" },
    offers: product.variations.map((variation) => ({
      "@type": "Offer",
      sku: variation.sku || variation.id,
      name: variation.name,
      price: (variation.price / 100).toFixed(2),
      priceCurrency: offerCurrency,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${BASE_URL}/product/${product.slug}`,
      shippingDetails,
      hasMerchantReturnPolicy: returnPolicy,
      seller: {
        "@type": "Organization",
        name: "After Hours Agenda",
      },
    })),
    // Only emit AggregateRating from REAL approved reviews (never fabricated).
    ...(reviews && reviews.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.average.toFixed(1),
            reviewCount: reviews.count,
          },
        }
      : {}),
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
