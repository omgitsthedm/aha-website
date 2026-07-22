export const PRODUCTION_WINDOW = "2 to 5 business days";
export const DELIVERY_WINDOW = "usually 5 to 10 business days after production";
export const RETURNS_WINDOW = "30 days";

export const RETURNS_SUMMARY =
  "Unworn items can be returned within 30 days and we cover return shipping; made-to-order production fees may be non-refundable once printing starts.";

export const RETURN_SHIPPING_COPY =
  "We cover return shipping. Email support first and we send a prepaid label.";

export const WALLET_CHECKOUT_COPY =
  "Square shows supported wallets before card entry when Apple Pay or Google Pay is available on your device.";

export const TAX_LINE_COPY =
  "Estimated by shipping address in Square before you pay";

/** Domestic ships free; every other country the storefront sells to is a $20 flat rate per order. */
export const DOMESTIC_COUNTRY = "US";
export const INTERNATIONAL_SHIPPING_CENTS = 2000;
export const INTERNATIONAL_SHIPPING_LABEL = "International shipping";

export function isInternational(country: string | undefined | null): boolean {
  return Boolean(country) && country!.toUpperCase() !== DOMESTIC_COUNTRY;
}

/**
 * Cart-stage copy. The cart runs before a shipping address exists, so it states
 * both rates rather than guessing which one applies.
 */
export function getShippingLineCopy(totalCents: number): string {
  void totalCents;
  return "Free in the US, $20 international";
}

/** Checkout-stage copy, once the country is known. */
export function getShippingCopyForCountry(country: string | undefined | null): string {
  return isInternational(country) ? "$20 flat rate" : "Free standard shipping";
}

export function getFulfillmentSummary(): string {
  return `Made to order in ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}.`;
}
