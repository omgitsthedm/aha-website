import type {
  ApliiqAddress,
  ApliiqAddressPayload,
  ApliiqClient,
  ApliiqCreateOrderResponse,
  ApliiqCreateOrderResult,
  ApliiqFulfillmentStatus,
  ApliiqOrderPayload,
  ApliiqOrderRecord,
  CreateApliiqOrderInput,
  NormalizedApliiqTracking,
} from "./types";

/** Public examples use seven digits even though older docs illustrate eight. */
const APLIIQ_SKU_PATTERN = /^APQ-\d{7,}S\d+A\d+$/;
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const US_COUNTRY_CODE = "US";

export class ApliiqValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Apliiq order validation failed: ${issues.join("; ")}`);
    this.name = "ApliiqValidationError";
  }
}

export function isApliiqSku(value: string): boolean {
  return APLIIQ_SKU_PATTERN.test(value);
}

function isPopulated(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function validateApliiqAddress(
  address: ApliiqAddress,
  label = "shippingAddress"
): string[] {
  const issues: string[] = [];
  for (const key of ["firstName", "lastName", "address1", "city", "zip", "province", "country"] as const) {
    if (!isPopulated(address[key])) issues.push(`${label}.${key} is required`);
  }
  if (!COUNTRY_CODE_PATTERN.test(address.countryCode)) {
    issues.push(`${label}.countryCode must be an uppercase ISO alpha-2 code`);
  }
  if (address.countryCode === US_COUNTRY_CODE && !/^[A-Z]{2}$/.test(address.provinceCode ?? "")) {
    issues.push(`${label}.provinceCode must be a two-letter US state code for US shipping`);
  }
  return issues;
}

export function validateCreateApliiqOrder(input: CreateApliiqOrderInput): string[] {
  const issues: string[] = [];
  if (input.id === "" || input.id === null || input.id === undefined) issues.push("id is required");
  if (input.number === "" || input.number === null || input.number === undefined) issues.push("number is required");
  if (!isPopulated(input.name)) issues.push("name is required");
  if (input.orderNumber === "" || input.orderNumber === null || input.orderNumber === undefined) issues.push("orderNumber is required");
  if (input.lineItems.length === 0) issues.push("at least one line item is required");

  input.lineItems.forEach((item, index) => {
    const label = `lineItems[${index}]`;
    if (item.id === "" || item.id === null || item.id === undefined) issues.push(`${label}.id is required`);
    if (!isPopulated(item.title) && !isPopulated(item.name)) issues.push(`${label}.title or ${label}.name is required`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) issues.push(`${label}.quantity must be a positive integer`);
    if (!MONEY_PATTERN.test(item.price)) issues.push(`${label}.price must be a non-negative decimal amount`);
    if (!isApliiqSku(item.sku)) issues.push(`${label}.sku must be an Apliiq APQ SKU`);
    if (item.grams !== undefined && (!Number.isFinite(item.grams) || item.grams < 0)) issues.push(`${label}.grams must be non-negative`);
  });

  issues.push(...validateApliiqAddress(input.shippingAddress));
  if (input.billingAddress) issues.push(...validateApliiqAddress(input.billingAddress, "billingAddress"));
  return issues;
}

function assertValid(input: CreateApliiqOrderInput): void {
  const issues = validateCreateApliiqOrder(input);
  if (issues.length) throw new ApliiqValidationError(issues);
}

function toApliiqAddressPayload(address: ApliiqAddress): ApliiqAddressPayload {
  return {
    ...(address.company ? { company: address.company } : {}),
    first_name: address.firstName,
    last_name: address.lastName,
    address1: address.address1,
    ...(address.address2 ? { address2: address.address2 } : {}),
    ...(address.phone ? { phone: address.phone } : {}),
    city: address.city,
    zip: address.zip,
    province: address.province,
    ...(address.provinceCode ? { province_code: address.provinceCode } : {}),
    country: address.country,
    country_code: address.countryCode,
  };
}

/** Build the exact public Apliiq create-order wire payload after fail-closed validation. */
export function buildApliiqOrderPayload(input: CreateApliiqOrderInput): ApliiqOrderPayload {
  assertValid(input);
  return {
    id: input.id,
    number: input.number,
    name: input.name,
    order_number: input.orderNumber,
    line_items: input.lineItems.map((item) => ({
      id: item.id,
      ...(item.title ? { title: item.title } : {}),
      ...(item.name ? { name: item.name } : {}),
      quantity: item.quantity,
      price: item.price,
      grams: item.grams ?? 0,
      sku: item.sku,
    })),
    ...(input.billingAddress ? { billing_address: toApliiqAddressPayload(input.billingAddress) } : {}),
    shipping_address: toApliiqAddressPayload(input.shippingAddress),
    ...(input.shippingCode ? { shipping_lines: [{ code: input.shippingCode }] } : {}),
  };
}

export async function createApliiqOrder(
  client: ApliiqClient,
  input: CreateApliiqOrderInput
): Promise<ApliiqCreateOrderResult> {
  const result = await client.requestWithMetadata<ApliiqCreateOrderResponse>("/Order", {
    method: "POST",
    body: buildApliiqOrderPayload(input),
  });
  if (result.status === 200) {
    return { status: 200, outcome: "processed", response: result.data };
  }
  if (result.status === 202) {
    return { status: 202, outcome: "accepted", response: result.data };
  }
  throw new Error(`Unexpected successful Apliiq create-order status: ${result.status}.`);
}

/** The API documents this endpoint as an array even for one order id. */
export async function getApliiqOrder(
  client: ApliiqClient,
  orderId: string | number
): Promise<ApliiqOrderRecord[]> {
  if (`${orderId}`.trim() === "") throw new Error("Apliiq orderId is required.");
  return client.request<ApliiqOrderRecord[]>(`/Order/${encodeURIComponent(String(orderId))}`);
}

/** Retrieve recent orders (default) or a documented month/year filter. */
export async function listApliiqOrders(
  client: ApliiqClient,
  yearOrLastNoMonth?: number
): Promise<ApliiqOrderRecord[]> {
  if (yearOrLastNoMonth !== undefined
    && (!Number.isInteger(yearOrLastNoMonth) || yearOrLastNoMonth <= 0)) {
    throw new Error("Apliiq yearOrLastNoMonth must be a positive integer.");
  }
  const query = yearOrLastNoMonth === undefined
    ? ""
    : `?yearOrlastNoMonth=${encodeURIComponent(String(yearOrLastNoMonth))}`;
  return client.request<ApliiqOrderRecord[]>(`/Order${query}`);
}

function normalizedStatus(value: string | undefined): ApliiqFulfillmentStatus {
  switch (value?.trim().toLowerCase().replace(/\s+/g, " ")) {
    case "new":
      return "pending";
    case "preparing to release":
    case "ready to release":
    case "in production":
      return "in_production";
    case "ready to ship":
      return "ready_to_ship";
    case "shipped":
    case "success":
      return "shipped";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "on hold":
    case "payment pending":
      return "attention";
    default:
      return "unknown";
  }
}

function strings(value: unknown, predicate: (entry: string) => boolean = () => true): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && predicate(entry)))];
}

const secureUrl = (value: string): boolean => {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
};

/**
 * Never infer shipment from a tracking number. Provider status remains the
 * authority; only explicit shipped/success values become shipped here.
 */
export function normalizeApliiqOrderTracking(order: ApliiqOrderRecord): NormalizedApliiqTracking {
  const notices = Array.isArray(order.SN) ? order.SN : [];
  const carrierValues = notices.map((notice) => notice.Carrier?.trim()).filter((value): value is string => Boolean(value));
  const serviceValues = notices.map((notice) => notice.Service?.trim()).filter((value): value is string => Boolean(value));
  return {
    status: normalizedStatus(order.Status),
    ...(carrierValues.find((value) => !secureUrl(value)) ? { carrier: carrierValues.find((value) => !secureUrl(value)) } : {}),
    ...(serviceValues[0] ? { service: serviceValues[0] } : {}),
    trackingNumbers: [...new Set(notices.map((notice) => notice.TrackingNumber?.trim()).filter((value): value is string => Boolean(value)))],
    trackingUrls: [...new Set(carrierValues.filter(secureUrl))],
  };
}

export { normalizedStatus as normalizeApliiqFulfillmentStatus, strings as normalizeApliiqStringList, secureUrl as isSecureTrackingUrl };
