import { formatCents } from "@/lib/utils/money";

export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

export const PRODUCTION_WINDOW = "2 to 5 business days";
export const DELIVERY_WINDOW = "usually 5 to 10 business days after production";
export const RETURNS_WINDOW = "30 days";

export const RETURNS_SUMMARY =
  "Unworn items can be returned within 30 days; made-to-order production fees may be non-refundable once printing starts.";

export const WALLET_CHECKOUT_COPY =
  "Square shows supported wallets before card entry when Apple Pay or Google Pay is available on your device.";

export const TAX_LINE_COPY =
  "Estimated by shipping address in Square before you pay";

export function formatFreeShippingDelta(totalCents: number): string {
  return formatCents(Math.max(FREE_SHIPPING_THRESHOLD_CENTS - totalCents, 0));
}

export function getShippingLineCopy(totalCents: number): string {
  if (totalCents >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return "Free standard shipping unlocked";
  }

  return `Free standard shipping at ${formatCents(FREE_SHIPPING_THRESHOLD_CENTS)}; exact rate shown before payment`;
}

export function getFulfillmentSummary(): string {
  return `Made to order in ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}.`;
}
