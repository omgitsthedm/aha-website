// The typed shipping contact and every rule that can refuse to submit it.
// Kept out of the React component — like lib/checkout/express.ts — so the gate
// in front of a real charge is unit-testable without rendering a form.

import type { PostalVerdict } from "@/lib/checkout/postal-verification";

export interface ShippingContact {
  email: string;
  shippingName: string;
  address1: string;
  /** Apartment / suite / floor. Optional, but a missing one is undeliverable mail. */
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

const EMAIL_PATTERN = /.+@.+\..+/;

/** Address completeness only — no postal verification. Also gates the quote. */
export function getAddressError(contact: ShippingContact): string | null {
  if (!contact.shippingName) return "Enter the name for shipping.";
  if (!contact.address1 || !contact.city || !contact.zip) return "Complete your shipping address.";
  if (STATE_REQUIRED.has(contact.country) && !contact.state) return "State/province is required.";
  return null;
}

/**
 * The full submission gate: the reason this contact cannot be charged yet, or
 * null. `address2` is deliberately never required — plenty of addresses have no
 * unit — but a postal code that CONTRADICTS the typed city/state IS fatal: the
 * parcel ships to the wrong city, fails delivery and returns to AHA at AHA's
 * cost.
 *
 * A code the lookup could not confirm never blocks. "Unverified" covers both
 * an unreachable service AND a code the free dataset simply does not carry
 * (api.zippopotam.us 404s on deliverable APO/FPO and US-territory ZIPs), and
 * neither may stop the store taking money.
 */
export function getSubmissionBlockReason(contact: ShippingContact, postal: PostalVerdict): string | null {
  if (!contact.email || !EMAIL_PATTERN.test(contact.email)) return "Enter a valid email for your receipt.";
  const addressError = getAddressError(contact);
  if (addressError) return addressError;
  if (postal.status === "blocked") return postal.message;
  if (postal.status === "checking") return "Confirming your ZIP code — one moment.";
  return null;
}
