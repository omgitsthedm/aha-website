import type { Product } from "@/lib/utils/types";
import type { ReviewSummary } from "@/lib/commerce/reviews";
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
}

/**
 * Renders Product structured data (JSON-LD) for SEO rich snippets.
 * The JSON is generated from our own Product type (sourced from Square catalog)
 * and serialized with JSON.stringify which safely escapes special characters,
 * preventing script injection in the JSON-LD output.
 */
export function ProductJsonLd({ product, description, reviews }: ProductJsonLdProps) {
  // Guard against products with no variations (would crash Math.min/max)
  if (product.variations.length === 0) return null;

  // Strip HTML tags from description (Square may include formatting)
  const cleanDescription = (description || product.description)
    .replace(/<[^>]*>/g, "")
    .slice(0, 500);

  const offerCurrency = product.currency || "USD";
  const shippingDetails = buildShippingDetails(offerCurrency);
  const returnPolicy = buildReturnPolicy();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription,
    image: product.images.map((src) => absolutizeImage(src, BASE_URL)),
    url: `${BASE_URL}/product/${product.slug}`,
    brand: {
      "@type": "Brand",
      name: "After Hours Agenda",
    },
    offers: product.variations.map((variation) => ({
      "@type": "Offer",
      sku: variation.sku || variation.id,
      price: (variation.price / 100).toFixed(2),
      priceCurrency: offerCurrency,
      availability: "https://schema.org/InStock",
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
