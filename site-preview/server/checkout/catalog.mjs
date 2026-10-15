import { AHA_FULFILLMENT_CATALOG } from "../fulfillment/catalog.mjs";
import { CheckoutError } from "./errors.mjs";

export const SUPPORTED_COUNTRIES = new Set(["US", "CA", "GB", "IE", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "PL", "CZ", "GR", "CH", "NO", "TR", "JP", "AU"]);
export const CURRENCY = "USD";
const US_STATE_NAMES = Object.freeze({ AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia" });
const US_STATES = new Set(Object.keys(US_STATE_NAMES));
function normalizeUsRegion(value) { const upper = value.toUpperCase(); if (US_STATES.has(upper)) return upper; const match = Object.entries(US_STATE_NAMES).find(([, name]) => name.toUpperCase() === upper); return match?.[0] ?? value; }
export const DOMESTIC_SHIPPING_CENTS = 0;
export const INTERNATIONAL_SHIPPING_CENTS = 2500;

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 13) throw new CheckoutError("invalid_cart", 422);
  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item.variationId !== "string" || !/^[A-Z0-9]{20,30}$/.test(item.variationId)) throw new CheckoutError("invalid_cart", 422);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || seen.has(item.variationId)) throw new CheckoutError("invalid_cart", 422);
    const product = AHA_FULFILLMENT_CATALOG[item.variationId];
    if (!product) throw new CheckoutError("invalid_cart", 422);
    seen.add(item.variationId);
    return Object.freeze({ variationId: item.variationId, quantity: item.quantity, unitAmount: product.priceCents, totalAmount: product.priceCents * item.quantity, size: product.size, product: product.product });
  });
}

function text(value, max, required = true) {
  if (typeof value !== "string") { if (required) throw new CheckoutError("invalid_address", 422); return null; }
  const normalized = value.trim().replace(/\s+/g, " ");
  if ((required && !normalized) || normalized.length > max) throw new CheckoutError("invalid_address", 422);
  return normalized || null;
}

export function normalizeAddress(raw) {
  if (!raw || typeof raw !== "object") throw new CheckoutError("invalid_address", 422);
  const country = text(raw.country, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !SUPPORTED_COUNTRIES.has(country)) throw new CheckoutError("unsupported_destination", 422);
  const firstName = text(raw.firstName, 60);
  const lastName = text(raw.lastName, 60);
  const addressLine1 = text(raw.addressLine1, 120);
  const addressLine2 = text(raw.addressLine2, 120, false);
  const city = text(raw.city, 80);
  let region = text(raw.region, 80);
  const postalCode = text(raw.postalCode, 20);
  const email = text(raw.email, 254, false);
  const phone = text(raw.phone, 40, false);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("invalid_address", 422);
  if (country === "US") { region = normalizeUsRegion(region); if (!US_STATES.has(region) || !/^\d{5}(?:-\d{4})?$/.test(postalCode)) throw new CheckoutError("invalid_address", 422); }
  return Object.freeze({ firstName, lastName, addressLine1, addressLine2, city, region, postalCode, country, email, phone });
}

export function appliesArizonaTax(address) {
  return address.country === "US" && (address.region.toUpperCase() === "AZ" || /^(85|86)/.test(address.postalCode));
}

export function buildSquareOrder({ items, address, locationId, referenceId }) {
  const tax = appliesArizonaTax(address) ? [{ uid: "aha-tax-az", name: "Arizona TPT (Peoria 8.1%)", type: "ADDITIVE", percentage: "8.1", scope: "ORDER" }] : [];
  const shippingCents = address.country === "US" ? DOMESTIC_SHIPPING_CENTS : INTERNATIONAL_SHIPPING_CENTS;
  const order = {
    location_id: locationId,
    reference_id: referenceId,
    line_items: items.map((item) => ({ catalog_object_id: item.variationId, quantity: String(item.quantity) })),
    fulfillments: [{ uid: "aha-shipment", type: "SHIPMENT", state: "PROPOSED", shipment_details: { recipient: {
      display_name: `${address.firstName} ${address.lastName}`,
      email_address: address.email ?? undefined,
      phone_number: address.phone ?? undefined,
      address: {
        address_line_1: address.addressLine1,
        address_line_2: address.addressLine2 ?? undefined,
        locality: address.city,
        administrative_district_level_1: address.region,
        postal_code: address.postalCode,
        country: address.country,
      },
    } } }],
  };
  if (tax.length) order.taxes = tax;
  if (shippingCents) order.service_charges = [{ uid: "aha-shipping-international", name: "International shipping", amount_money: { amount: shippingCents, currency: CURRENCY }, calculation_phase: "TOTAL_PHASE", taxable: false, type: "CUSTOM" }];
  return order;
}

export function money(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new CheckoutError("checkout_unavailable", 503);
  return { amount: value, currency: CURRENCY };
}
