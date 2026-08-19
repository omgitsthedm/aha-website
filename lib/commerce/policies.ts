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
  "Arizona orders carry sales tax; calculated by shipping address before you pay";

/**
 * Domestic ships free; every other country the storefront sells to is a flat
 * rate per order.
 *
 * Set to $25 by merchant decision (David, 2026-08-17), knowingly accepting a
 * loss on larger baskets. Measured against APLIIQ's 2026-08-11 rate sheet at a
 * 7.9 oz tee, $25 covers: Canada and Germany to 4 units, the UK, France, Italy,
 * Spain, Netherlands, Turkey and Japan to 2, Ireland to 1. Beyond that AHA
 * absorbs the difference — a 4-tee order to Ireland costs $40.54 to ship.
 * scripts/margin-check.ts fails the build on a variant that is underwater
 * within the cart's own unit limit, so this stays visible rather than silent.
 */
export const DOMESTIC_COUNTRY = "US";
/**
 * Every country the storefront will ship to besides the US.
 *
 * Expanded 2026-08-17 to the markets David named — Canada, the UK, Europe,
 * Turkey and Japan — plus Australia, which was already enabled. Australia is not
 * in his stated market list but is left in place; removing a country a customer
 * could previously order from is a separate decision.
 *
 * Every entry here was verified to resolve a real freight rate against
 * data/apliiq-shipping-rates.json before being added. Never add a country
 * without that check: getApliiqInternationalShippingCents throws
 * unmodelled_destination for anything absent, which surfaces to the customer as
 * a failed quote at checkout.
 *
 * Shipping is DDU (see the international block in the rate table). The customer
 * pays import VAT and duties on delivery, and for EU destinations that means a
 * carrier handling fee on top. AHA is not IOSS-registered, so EU buyers WILL be
 * charged at the door — that must be stated plainly on the shipping page before
 * these markets are advertised.
 */
export const INTERNATIONAL_COUNTRIES = [
  // North America
  "CA",
  // UK and Ireland
  "GB", "IE",
  // EU
  "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "PL", "CZ", "GR",
  // Non-EU Europe
  "CH", "NO",
  // Rest of world
  "TR", "JP", "AU",
] as const;
export const SHIPPING_COUNTRIES = [DOMESTIC_COUNTRY, ...INTERNATIONAL_COUNTRIES] as const;

/**
 * English display names for every country the storefront ships to. The
 * checkout country <select> and the APLIIQ order payload (which needs the
 * country NAME as well as the ISO code) both read from here, so a market cannot
 * be enabled in INTERNATIONAL_COUNTRIES without also being nameable.
 */
export const SHIPPING_COUNTRY_NAMES: Readonly<Record<(typeof SHIPPING_COUNTRIES)[number], string>> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom", IE: "Ireland",
  DE: "Germany", FR: "France", IT: "Italy", ES: "Spain", NL: "Netherlands", BE: "Belgium", AT: "Austria",
  PT: "Portugal", SE: "Sweden", DK: "Denmark", FI: "Finland", PL: "Poland", CZ: "Czechia", GR: "Greece",
  CH: "Switzerland", NO: "Norway",
  TR: "Türkiye", JP: "Japan", AU: "Australia",
};

/** Ordered options for the checkout country select: US first, then the rest by name. */
export const SHIPPING_COUNTRY_OPTIONS: ReadonlyArray<{ code: (typeof SHIPPING_COUNTRIES)[number]; name: string }> = [
  { code: DOMESTIC_COUNTRY, name: SHIPPING_COUNTRY_NAMES[DOMESTIC_COUNTRY] },
  ...INTERNATIONAL_COUNTRIES
    .map((code) => ({ code, name: SHIPPING_COUNTRY_NAMES[code] }))
    .sort((a, b) => a.name.localeCompare(b.name, "en")),
];
export const INTERNATIONAL_SHIPPING_CENTS = 2500;
export const INTERNATIONAL_SHIPPING_LABEL = "International shipping";

/**
 * Sales tax. Merchant decision (David, 2026-08-19): collect only on orders
 * shipping to Arizona. AHA's Square location is Peoria, AZ 85381; Arizona is
 * origin-sourced for in-state retailers, so every AZ-bound order carries the
 * Peoria retail TPT rate — 5.6% state + 0.7% Maricopa + 1.8% city = 8.1%
 * (salestaxhandbook / Avalara, rates current Aug-2026). Applied as an ORDER
 * scope additive tax on the Square order (both the quote and the charge go
 * through buildSquareOrder), so Square computes it on the discounted subtotal,
 * never on the international freight service charge, and reports it as tax
 * collected. Non-AZ US destinations and international orders carry no tax.
 * Change the number here when the city rate changes; nothing else moves.
 */
export const SALES_TAX_RULES: ReadonlyArray<{ country: "US"; state: string; zipPrefixes: string[]; name: string; percentage: string }> = [
  { country: "US", state: "AZ", zipPrefixes: ["85", "86"], name: "Arizona TPT (Peoria 8.1%)", percentage: "8.1" },
];

const STATE_ALIASES: Record<string, string> = { ARIZONA: "AZ" };

/** Two-letter state for a free-text state field ("az", "Arizona", "AZ" → "AZ"). */
export function normalizeUsState(state: string | undefined | null): string {
  const raw = (state ?? "").trim().toUpperCase().replace(/\.$/, "");
  return STATE_ALIASES[raw] ?? raw;
}

/**
 * The tax rule for a shipping destination, or null when the order is untaxed.
 * The state field is free text on the checkout form, so a ZIP in the state's
 * range also qualifies — a Phoenix address typed as "Az." or left blank after
 * autofill still gets taxed; a typo can never remove tax from an AZ order.
 */
export function salesTaxRuleFor(address: { country?: string | null; state?: string | null; postalCode?: string | null } | undefined | null) {
  if (!address) return null;
  const country = (address.country ?? "US").trim().toUpperCase();
  if (country !== "US") return null;
  const state = normalizeUsState(address.state);
  const zip = (address.postalCode ?? "").trim();
  return SALES_TAX_RULES.find((rule) => rule.state === state || rule.zipPrefixes.some((prefix) => zip.startsWith(prefix))) ?? null;
}

export function isInternational(country: string | undefined | null): boolean {
  return Boolean(country) && country!.toUpperCase() !== DOMESTIC_COUNTRY;
}

// Truth-in-advertising. INTERNATIONAL_SHIPPING_CENTS is charged as a real Square
// service charge on every non-US order, so no surface may claim unqualified free
// shipping. Every marketing, SEO, and email surface routes through one of these
// three constants instead of writing its own string.
//
// The sentence deliberately does NOT enumerate countries. It named "Canada, the
// UK, and Australia" while INTERNATIONAL_COUNTRIES said the same three, and both
// would have had to change together every time the list moved. Derive the list
// where you need it; state the rate here.

/** Badge / trust-strip length. Use where only two or three words fit. */
export const SHIPPING_CLAIM_SHORT = "Free US shipping";
/** The qualifier that goes under or beside SHIPPING_CLAIM_SHORT, where a full sentence will not fit. */
export const SHIPPING_CLAIM_DETAIL = "$25 flat rate international";
/** Full sentence for body copy, FAQ answers, meta descriptions, and emails. */
export const SHIPPING_CLAIM_SENTENCE = "Free in the US; $25 flat rate everywhere else we ship.";

// Truth-in-advertising, origin edition. Print-on-demand production runs in
// Huntington Park, CA or Philadelphia, PA, and the fulfilling city is printed
// on the shipping label the customer receives — so no surface may pair a city
// with "printed", "made", or "shipped from". The brand also does not lean on a
// city at all: the claim is the way the piece is made, not where. Route every
// marketing, SEO, and email surface through one of these three constants.

/** Badge / trust-strip length. Mirrors components/ui/TrustStrip.tsx. */
export const ORIGIN_CLAIM_SHORT = "Made to order";
/** Mid-sentence clause. Lowercase lead so it can follow a comma. */
export const ORIGIN_CLAIM_CLAUSE = "made to order, printed one at a time";
/** Standalone sentence for body copy, category headers, and meta descriptions. */
export const ORIGIN_CLAIM_SENTENCE = "Made to order, printed one at a time.";

/**
 * Cart-stage copy. The cart runs before a shipping address exists, so it states
 * both rates rather than guessing which one applies.
 */
export function getShippingLineCopy(totalCents: number): string {
  void totalCents;
  return "Free in the US, $25 international";
}

/** Checkout-stage copy, once the country is known. */
export function getShippingCopyForCountry(country: string | undefined | null): string {
  return isInternational(country) ? "$25 flat rate" : "Free standard shipping";
}

export function getFulfillmentSummary(): string {
  return `Made to order in ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}.`;
}
