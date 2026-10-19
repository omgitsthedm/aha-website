// Shipping and return terms in every product's structured data (the build and
// the live renderer use the same objects, so their pages stay byte-identical).
// Delivery days come from src/data/delivery.json; the return terms match the
// returns page: 30 days from delivery, by mail, return shipping covered.
import delivery from "../../src/data/delivery.json" with { type: "json" };

const [productionMin, productionMax] = delivery.productionBusinessDays;
const [transitMin, transitMax] = delivery.domesticShippingBusinessDays;

export const SHIPPING_DETAILS = Object.freeze({
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "USD" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: productionMin, maxValue: productionMax, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: transitMin, maxValue: transitMax, unitCode: "DAY" },
  },
});

export const RETURN_POLICY = Object.freeze({
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
});
