/**
 * The provider's public API uses Shopify-style snake_case payloads. Keep that
 * wire contract separate from the storefront's internal order records.
 */
export interface ApliiqAddress {
  company?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  phone?: string;
  city: string;
  zip: string;
  province: string;
  /** Required for US destinations and must be the two-letter state code. */
  provinceCode?: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
}

export interface ApliiqOrderLineItem {
  /** Stable, store-wide unique line-item id. */
  id: string | number;
  title?: string;
  name?: string;
  quantity: number;
  /** Decimal USD amount as required by Apliiq, for example "45.50". */
  price: string;
  grams?: number;
  /** Apliiq production SKU, for example APQ-1998244S7A1. */
  sku: string;
}

export type ApliiqShippingCode = "standard" | "upgraded" | "rush";

export interface CreateApliiqOrderInput {
  /** Store-system order id; this is the provider's idempotency identity. */
  id: string | number;
  number: string | number;
  name: string;
  orderNumber: string | number;
  lineItems: ApliiqOrderLineItem[];
  billingAddress?: ApliiqAddress;
  shippingAddress: ApliiqAddress;
  shippingCode?: ApliiqShippingCode;
}

export interface ApliiqAddressPayload {
  company?: string;
  first_name: string;
  last_name: string;
  address1: string;
  address2?: string;
  phone?: string;
  city: string;
  zip: string;
  province: string;
  province_code?: string;
  country: string;
  country_code: string;
}

export interface ApliiqOrderPayload {
  id: string | number;
  number: string | number;
  name: string;
  order_number: string | number;
  line_items: Array<{
    id: string | number;
    title?: string;
    name?: string;
    quantity: number;
    price: string;
    /** Per-unit shipped weight. Omitted when unknown — never sent as a false 0. */
    grams?: number;
    sku: string;
  }>;
  billing_address?: ApliiqAddressPayload;
  shipping_address: ApliiqAddressPayload;
  shipping_lines?: Array<{ code: ApliiqShippingCode }>;
}

export interface ApliiqCreateOrderResponse {
  /** Present after Apliiq has created an order. */
  id?: string | number;
  /** Apliiq may explain a 202 accepted-but-not-processed response here. */
  message?: string;
  Message?: string;
}

export interface ApliiqResponse<T> {
  /** HTTP status is intentionally retained for caller-controlled workflow decisions. */
  status: number;
  data: T;
}

export type ApliiqCreateOrderResult =
  | { status: 200; outcome: "processed"; response: ApliiqCreateOrderResponse }
  | { status: 202; outcome: "accepted"; response: ApliiqCreateOrderResponse };

export interface ApliiqShipmentItem {
  SKU?: string;
  Name?: string;
  Quantity?: number | string;
  sku?: string;
  name?: string;
  quantity?: number | string;
}

/** Apliiq's order-detail response calls shipment notices `SN`. */
export interface ApliiqShipmentNotice {
  Helptext?: string;
  Carrier?: string;
  Service?: string;
  TrackingNumber?: string;
  Items?: ApliiqShipmentItem[];
}

export interface ApliiqOrderRecord {
  OrderId?: string | number;
  OrderDate?: string;
  ExpectedDate?: string;
  DeliveryPromiseMsg?: string;
  TotalQty?: number;
  SN?: ApliiqShipmentNotice[];
  StoreName?: string;
  StoreOrderId?: string | number;
  StoreSystemOrderId?: string | number;
  Status?: string;
  AwaitingGarment?: boolean;
  AwaitingArtwork?: boolean;
  AwaitingSupplies?: boolean;
  CanChangeShipAddress?: boolean;
}

export interface ApliiqFulfillmentWebhookPayload {
  fulfillment?: {
    order_id?: string | number;
    status?: string;
    tracking_company?: string;
    tracking_numbers?: unknown;
    tracking_urls?: unknown;
    line_items?: Array<{
      id?: string | number;
      quantity?: number | string;
      sku?: string;
      name?: string;
    }>;
  };
}

export type ApliiqFulfillmentStatus =
  | "pending"
  | "in_production"
  | "ready_to_ship"
  | "shipped"
  | "cancelled"
  | "attention"
  | "unknown";

export interface NormalizedApliiqTracking {
  status: ApliiqFulfillmentStatus;
  carrier?: string;
  service?: string;
  trackingNumbers: string[];
  trackingUrls: string[];
}

export interface ApliiqCredentials {
  apiKey: string;
  sharedSecret: string;
}

export type ApliiqFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApliiqClient {
  request<T>(endpoint: string, options?: ApliiqRequestOptions): Promise<T>;
  requestWithMetadata<T>(endpoint: string, options?: ApliiqRequestOptions): Promise<ApliiqResponse<T>>;
}

export interface ApliiqRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}
