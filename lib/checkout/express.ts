// Pure helpers for the express (wallet) checkout flow. Kept out of the React
// component so the risky bits — parsing the wallet's shipping contact and the
// fail-safe decision — are unit-testable without a real Apple/Google Pay device.

export interface ExpressContact {
  email: string;
  shippingName: string;
  shippingAddress: {
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

/**
 * Square's wallet token result carries the buyer's shipping/billing contact in
 * `details`. The exact shape isn't guaranteed across wallets/SDK versions, so we
 * read defensively from the known fields and return null when anything required
 * is missing — the caller then falls back to the normal /checkout form rather
 * than charging with a partial address.
 */
export function extractExpressContact(tokenDetails: unknown): ExpressContact | null {
  const details = (tokenDetails ?? {}) as Record<string, unknown>;
  const shipping = (details.shipping ?? {}) as Record<string, unknown>;
  const billing = (details.billing ?? {}) as Record<string, unknown>;
  const shipContact = (shipping.contact ?? shipping) as Record<string, unknown>;
  const billContact = (billing.contact ?? billing) as Record<string, unknown>;

  const str = (...vals: unknown[]): string => {
    for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
    return "";
  };

  const email = str(shipContact.email, billContact.email, details.email);
  const givenName = str(shipContact.givenName, shipContact.firstName, billContact.givenName);
  const familyName = str(shipContact.familyName, shipContact.lastName, billContact.familyName);
  const shippingName = str(shipContact.name, `${givenName} ${familyName}`);

  const line1 = str(shipContact.addressLine1, shipContact.address1, shipContact.line1);
  const city = str(shipContact.city, shipContact.locality);
  const state = str(shipContact.state, shipContact.administrativeDistrictLevel1, shipContact.region);
  const zip = str(shipContact.postalCode, shipContact.zip, shipContact.postal);
  const country = str(shipContact.countryCode, shipContact.country) || "US";

  if (!email || !line1 || !city || !zip) return null;

  return {
    email,
    shippingName: shippingName || "Customer",
    shippingAddress: { address1: line1, city, state, zip, country },
  };
}

/** Wallet paymentRequest total (dollars string). */
export function expressTotalAmount(cents: number): string {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}

export function isExpressCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPRESS_CHECKOUT_ENABLED === "true";
}
