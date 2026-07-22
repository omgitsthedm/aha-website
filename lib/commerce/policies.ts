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

export function getShippingLineCopy(totalCents: number): string {
  void totalCents;
  return "Free standard shipping";
}

export function getFulfillmentSummary(): string {
  return `Made to order in ${PRODUCTION_WINDOW}. Delivery is ${DELIVERY_WINDOW}.`;
}
