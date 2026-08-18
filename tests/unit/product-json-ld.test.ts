import { INTERNATIONAL_SHIPPING_CENTS, SHIPPING_COUNTRIES } from "@/lib/commerce/policies";
import { describe, expect, it } from "vitest";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import type { ReviewSummary } from "@/lib/commerce/reviews";
import type { Product } from "@/lib/utils/types";

const product: Product = {
  id: "shirt-1",
  slug: "night-shirt",
  name: "Night Shirt",
  description: "Made-to-order shirt.",
  price: 4200,
  priceFormatted: "$42.00",
  currency: "USD",
  images: ["/shirt.jpg"],
  collectionIds: [],
  collectionNames: [],
  variations: [
    {
      id: "shirt-small",
      name: "Small",
      sku: "NIGHT-S",
      price: 4200,
      priceFormatted: "$42.00",
      ordinal: 0,
    },
    {
      id: "shirt-large",
      name: "Large",
      sku: "NIGHT-L",
      price: 4200,
      priceFormatted: "$42.00",
      ordinal: 1,
    },
  ],
};

type ProductJsonLdData = {
  aggregateRating?: {
    ratingValue: string;
    reviewCount: number;
  };
  offers: Array<{
    shippingDetails: Array<{
      shippingRate: { value: number; currency: string };
      shippingDestination: { addressCountry: string };
      deliveryTime: {
        handlingTime: { minValue: number; maxValue: number; unitCode: string };
        transitTime: { minValue: number; maxValue: number; unitCode: string };
      };
    }>;
    hasMerchantReturnPolicy: {
      applicableCountry: string[];
      returnPolicyCategory: string;
      merchantReturnDays: number;
      returnMethod: string;
      merchantReturnLink: string;
      returnFees?: string;
    };
  }>;
};

function renderJsonLd(reviews?: ReviewSummary): ProductJsonLdData {
  const element = ProductJsonLd({ product, reviews }) as unknown as {
    props: { dangerouslySetInnerHTML: { __html: string } };
  };

  return JSON.parse(element.props.dangerouslySetInnerHTML.__html) as ProductJsonLdData;
}

describe("ProductJsonLd", () => {
  it("adds the published shipping and return policies to every offer", () => {
    const data = renderJsonLd();

    expect(data.offers).toHaveLength(2);
    for (const offer of data.offers) {
      expect(offer.shippingDetails).toHaveLength(SHIPPING_COUNTRIES.length);
      expect(
        offer.shippingDetails.map((details) => ({
          country: details.shippingDestination.addressCountry,
          rate: details.shippingRate.value,
          currency: details.shippingRate.currency,
        })),
      // Derived from the shipping list, not a fixed set: the list grew 3 -> 22
      // on 2026-08-17 and an enumerated expectation would have to be rewritten
      // every time a market opens. What must hold is the RULE — US free,
      // everywhere else the flat rate, one entry per shippable country, in the
      // declared order.
      ).toEqual(
        SHIPPING_COUNTRIES.map((country) => ({
          country,
          rate: country === "US" ? 0 : INTERNATIONAL_SHIPPING_CENTS / 100,
          currency: "USD",
        })),
      );
      expect(offer.shippingDetails).toHaveLength(SHIPPING_COUNTRIES.length);
      expect(offer.shippingDetails[0].deliveryTime).toEqual({
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 2,
          maxValue: 5,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 5,
          maxValue: 10,
          unitCode: "DAY",
        },
      });
      expect(offer.hasMerchantReturnPolicy).toMatchObject({
        applicableCountry: [...SHIPPING_COUNTRIES],
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
        merchantReturnLink: "https://afterhoursagenda.com/returns",
      });
      expect(offer.hasMerchantReturnPolicy.returnFees).toBeUndefined();
    }
  });

  it("does not fabricate aggregate ratings and only emits approved review totals", () => {
    expect(renderJsonLd().aggregateRating).toBeUndefined();
    expect(
      renderJsonLd({ items: [], count: 0, average: 0 }).aggregateRating,
    ).toBeUndefined();
    expect(
      renderJsonLd({ items: [], count: 3, average: 4.7 }).aggregateRating,
    ).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.7",
      reviewCount: 3,
    });
  });
});
