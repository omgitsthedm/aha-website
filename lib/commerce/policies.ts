export const PRODUCTION_MIN_BUSINESS_DAYS = 2;
export const PRODUCTION_MAX_BUSINESS_DAYS = 5;
export const DELIVERY_MIN_BUSINESS_DAYS_AFTER_PRODUCTION = 5;
export const DELIVERY_MAX_BUSINESS_DAYS_AFTER_PRODUCTION = 10;
export const RETURNS_WINDOW_DAYS = 30;

export const PRODUCTION_WINDOW = `${PRODUCTION_MIN_BUSINESS_DAYS} to ${PRODUCTION_MAX_BUSINESS_DAYS} business days`;
export const DELIVERY_WINDOW = `usually ${DELIVERY_MIN_BUSINESS_DAYS_AFTER_PRODUCTION} to ${DELIVERY_MAX_BUSINESS_DAYS_AFTER_PRODUCTION} business days after production`;
export const RETURNS_WINDOW = `${RETURNS_WINDOW_DAYS} days`;

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
export const INTERNATIONAL_COUNTRIES = ["CA", "GB", "AU"] as const;
export const SHIPPING_COUNTRIES = [DOMESTIC_COUNTRY, ...INTERNATIONAL_COUNTRIES] as const;
export const INTERNATIONAL_SHIPPING_CENTS = 2000;
export const INTERNATIONAL_SHIPPING_LABEL = "International shipping";

export function isInternational(country: string | undefined | null): boolean {
  return Boolean(country) && country!.toUpperCase() !== DOMESTIC_COUNTRY;
}

// Truth-in-advertising. INTERNATIONAL_SHIPPING_CENTS is charged as a real Square
// service charge on CA/GB/AU orders, so no surface may claim unqualified free
// shipping. Every marketing, SEO, and email surface routes through one of these
// three constants instead of writing its own string.

/** Badge / trust-strip length. Use where only two or three words fit. */
export const SHIPPING_CLAIM_SHORT = "Free US shipping";
/** The qualifier that goes under or beside SHIPPING_CLAIM_SHORT, where a full sentence will not fit. */
export const SHIPPING_CLAIM_DETAIL = "$20 flat rate international";
/** Full sentence for body copy, FAQ answers, meta descriptions, and emails. */
export const SHIPPING_CLAIM_SENTENCE = "Free in the US; $20 flat rate to Canada, the UK, and Australia.";

// Truth-in-advertising, origin edition. Print-on-demand production runs in
// Huntington Park, CA or Philadelphia, PA — never New York — and the fulfilling
// city is printed on the shipping label the customer receives. Design is the
// only part of the process that happens in NYC, so no surface may pair a city
// name with "printed", "made", or "shipped from". Route every marketing, SEO,
// and email surface through one of these three constants instead of writing
// its own string.

/** Badge / trust-strip length. Mirrors components/ui/TrustStrip.tsx. */
export const ORIGIN_CLAIM_SHORT = "Designed in NYC";
/** Mid-sentence clause. Lowercase lead so it can follow a comma. */
export const ORIGIN_CLAIM_CLAUSE = "designed in NYC, printed to order";
/** Standalone sentence for body copy, category headers, and meta descriptions. */
export const ORIGIN_CLAIM_SENTENCE = "Designed in NYC and printed to order.";

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
