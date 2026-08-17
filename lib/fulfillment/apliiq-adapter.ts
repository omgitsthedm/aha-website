import { createApliiqClient } from "@/lib/apliiq/client";
import { createApliiqOrder } from "@/lib/apliiq/orders";
import type { ApliiqAddress, ApliiqClient, ApliiqShippingCode, CreateApliiqOrderInput } from "@/lib/apliiq/types";
import type { OrderContact, RevalidatedItem } from "@/lib/commerce/orders";

export interface ApliiqFulfillmentRequest {
  orderId: number;
  externalOrderNumber: string;
  /**
   * A durable client reference written to the fulfillment row before POST.
   * It is also sent to APLIIQ so an uncertain request can be investigated
   * without submitting it again.
   */
  providerRequestId: string;
  contact: OrderContact;
  items: readonly RevalidatedItem[];
}

export type ApliiqSubmissionResult =
  | { outcome: "processed"; providerOrderId: string }
  | { outcome: "accepted"; attentionReason: string };

export interface ApliiqSubmissionEnvironment {
  context?: string;
  squareEnvironment?: string;
  fulfillmentMode?: string;
  allowCreateOrders?: string;
  liveMode?: string;
}

function currentSubmissionEnvironment(): ApliiqSubmissionEnvironment {
  return {
    context: process.env.CONTEXT,
    squareEnvironment: process.env.SQUARE_ENVIRONMENT,
    fulfillmentMode: process.env.AHA_FULFILLMENT_MODE,
    allowCreateOrders: process.env.APLIIQ_ALLOW_CREATE_ORDERS,
    liveMode: process.env.APLIIQ_LIVE_MODE,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function identifierValue(value: unknown): string | undefined {
  const asString = stringValue(value);
  if (asString) return asString;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

function addressValue(address: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringValue(address[key]);
    if (value) return value;
  }
  return undefined;
}

function personName(name: string | undefined, fallback: string): { firstName: string; lastName: string } {
  const words = (name ?? fallback).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "Customer", lastName: "Order" };
  if (words.length === 1) return { firstName: words[0], lastName: "Order" };
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}

function countryName(countryCode: string, country: string | undefined): string {
  if (country && country.toUpperCase() !== countryCode) return country;
  const knownNames: Record<string, string> = {
    US: "United States",
    CA: "Canada",
    GB: "United Kingdom",
    AU: "Australia",
  };
  if (knownNames[countryCode]) return knownNames[countryCode];
  if (country && country.length > 2) return country;
  throw new Error("APLIIQ fulfillment requires a shipping country name for non-US destinations.");
}

/** Convert the purchase-time shipping snapshot to APLIIQ's strict wire shape. */
export function buildApliiqAddress(contact: OrderContact): ApliiqAddress {
  const address = (contact.shippingAddress ?? {}) as Record<string, unknown>;
  const rawCountry = addressValue(address, "countryCode", "country_code", "country");
  const countryCode = rawCountry?.toUpperCase();
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("APLIIQ fulfillment requires a two-letter shipping country code.");
  }
  const rawProvince = addressValue(address, "state", "province");
  const provinceCode = addressValue(address, "stateCode", "state_code", "provinceCode", "province_code")
    ?? (rawProvince && /^[A-Za-z]{2}$/.test(rawProvince) ? rawProvince.toUpperCase() : undefined);
  const name = personName(contact.shippingName, contact.email);
  const address1 = addressValue(address, "address1", "address_1");
  const city = addressValue(address, "city");
  const zip = addressValue(address, "zip", "postalCode", "postal_code");
  if (!address1 || !city || !zip || !rawProvince) {
    throw new Error("APLIIQ fulfillment requires a complete purchase-time shipping address.");
  }
  return {
    ...name,
    address1,
    ...(addressValue(address, "address2", "address_2") ? { address2: addressValue(address, "address2", "address_2") } : {}),
    ...(contact.phone ? { phone: contact.phone } : {}),
    city,
    zip,
    province: rawProvince,
    ...(provinceCode ? { provinceCode } : {}),
    country: countryName(countryCode, addressValue(address, "countryName", "country_name", "country")),
    countryCode,
  };
}

function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("APLIIQ fulfillment requires a nonnegative integer unit price in cents.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function assertApliiqPurchaseSnapshot(item: RevalidatedItem): void {
  if (!item.providerSnapshot || typeof item.providerSnapshot !== "object" || Array.isArray(item.providerSnapshot)) {
    throw new Error(`APLIIQ fulfillment is missing immutable mapping evidence for ${item.ahaVariantId}.`);
  }
  const snapshot = item.providerSnapshot as Record<string, unknown>;
  if (snapshot.mappingApproval !== "approved" || snapshot.sampleApproval !== "approved") {
    throw new Error(`APLIIQ fulfillment requires approved mapping and sample evidence for ${item.ahaVariantId}.`);
  }
  for (const field of ["decoration", "privateLabel"] as const) {
    const value = snapshot[field];
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
      throw new Error(`APLIIQ fulfillment is missing immutable ${field} evidence for ${item.ahaVariantId}.`);
    }
  }
  const snapshotSku = stringValue(snapshot.apliiqSku);
  if (!snapshotSku || snapshotSku !== stringValue(item.providerSku)) {
    throw new Error(`APLIIQ fulfillment provider SKU does not match its immutable snapshot for ${item.ahaVariantId}.`);
  }
}

/** Validate an explicit supported shipping selection, defaulting to standard. */
export function getApliiqDefaultShipping(value = process.env.APLIIQ_DEFAULT_SHIPPING): ApliiqShippingCode {
  const shippingCode = value ?? "standard";
  if (shippingCode !== "standard" && shippingCode !== "upgraded" && shippingCode !== "rush") {
    throw new Error("APLIIQ_DEFAULT_SHIPPING must be one of standard, upgraded, or rush.");
  }
  return shippingCode;
}

/** Every individual rail is intentionally required; no single flag activates APLIIQ. */
export function getApliiqSubmissionBlockReason(
  environment: ApliiqSubmissionEnvironment = currentSubmissionEnvironment()
): string | null {
  if (environment.context !== "production") return "APLIIQ order submission requires CONTEXT=production.";
  if (environment.squareEnvironment !== "production") return "APLIIQ order submission requires SQUARE_ENVIRONMENT=production.";
  if (environment.fulfillmentMode !== "auto") return "APLIIQ order submission requires AHA_FULFILLMENT_MODE=auto.";
  if (environment.allowCreateOrders !== "true") return "APLIIQ order submission requires APLIIQ_ALLOW_CREATE_ORDERS=true.";
  if (environment.liveMode !== "true") return "APLIIQ order submission requires APLIIQ_LIVE_MODE=true.";
  return null;
}

/**
 * Build a deterministic APLIIQ order from immutable order-line fields. The
 * line id deliberately derives from the durable provider request identity,
 * never a currently live product record.
 */
export function buildApliiqFulfillmentOrder(
  request: ApliiqFulfillmentRequest
): CreateApliiqOrderInput {
  if (request.items.length === 0) throw new Error("APLIIQ fulfillment requires at least one line item.");
  return {
    id: request.providerRequestId,
    number: request.externalOrderNumber,
    name: request.externalOrderNumber,
    orderNumber: request.externalOrderNumber,
    lineItems: request.items.map((item, index) => {
      if (item.fulfillmentProvider !== "apliiq") {
        throw new Error("APLIIQ fulfillment received a non-APLIIQ purchase snapshot.");
      }
      assertApliiqPurchaseSnapshot(item);
      const sku = stringValue(item.providerSku);
      if (!sku) throw new Error(`APLIIQ fulfillment is missing a provider SKU for ${item.ahaVariantId}.`);
      return {
        id: `${request.providerRequestId}:${index + 1}`,
        title: item.title,
        quantity: item.quantity,
        price: centsToDecimal(item.unitPrice),
        sku,
      };
    }),
    shippingAddress: buildApliiqAddress(request.contact),
    shippingCode: getApliiqDefaultShipping(),
  };
}

/** APLIIQ is fail-closed unless every server-side production rail is exact. */
export function isApliiqSubmissionAllowed(environment?: ApliiqSubmissionEnvironment): boolean {
  return getApliiqSubmissionBlockReason(environment) === null;
}

/** Construct only after the durable claim exists; this never logs credentials. */
export function createLiveApliiqClient(): ApliiqClient {
  const apiKey = process.env.APLIIQ_API_KEY;
  const sharedSecret = process.env.APLIIQ_SHARED_SECRET;
  if (!apiKey || !sharedSecret) {
    throw new Error("APLIIQ credentials are not configured for live order submission.");
  }
  return createApliiqClient({ apiKey, sharedSecret });
}

/**
 * One create call only. The client intentionally has no POST retry behavior;
 * callers must put any network error into manual attention and reconcile by
 * providerRequestId rather than sending the request a second time.
 */
export async function submitApliiqFulfillment(
  client: ApliiqClient,
  request: ApliiqFulfillmentRequest
): Promise<ApliiqSubmissionResult> {
  const blocked = getApliiqSubmissionBlockReason();
  if (blocked) {
    throw new Error(blocked);
  }
  const result = await createApliiqOrder(client, buildApliiqFulfillmentOrder(request));
  if (result.outcome === "accepted") {
    return {
      outcome: "accepted",
      attentionReason: result.response.message ?? result.response.Message ?? "APLIIQ accepted the order for asynchronous review.",
    };
  }
  const providerOrderId = identifierValue(result.response.id);
  if (!providerOrderId) {
    throw new Error("APLIIQ processed the order without returning an order id; manual reconciliation is required.");
  }
  return { outcome: "processed", providerOrderId };
}
