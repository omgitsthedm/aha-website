// Shipping and return terms in every product's structured data (the build and
// the live renderer use the same objects, so their pages stay byte-identical).
// Delivery days come from src/data/delivery.json; the return terms match the
// returns page: request within 30 days, no production deduction or return shipment.
// Do not advertise ReturnByMail for the owner’s contact-led, returnless resolution.
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
  merchantReturnLink: "https://afterhoursagenda.com/returns/",
  refundType: "https://schema.org/FullRefund",
  returnFees: "https://schema.org/FreeReturn",
});
