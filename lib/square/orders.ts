import { squareRequest } from "./client";

export interface LineItem {
  catalogObjectId: string;
  quantity: string;
}

export interface CreateOrderRequest {
  lineItems: LineItem[];
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    administrativeDistrictLevel1: string;
    postalCode: string;
    country: string;
    firstName: string;
    lastName: string;
  };
}

export interface SquareOrderInput {
  location_id: string | undefined;
  pricing_options: { auto_apply_taxes: true };
  line_items: Array<{ catalog_object_id: string; quantity: string }>;
  fulfillments: Array<{
    type: "SHIPMENT";
    state: "PROPOSED";
    shipment_details: {
      recipient: {
        display_name: string;
        address: {
          address_line_1: string;
          address_line_2?: string;
          locality: string;
          administrative_district_level_1: string;
          postal_code: string;
          country: string;
        };
      };
    };
  }>;
}

/** One trusted order shape is shared by quote calculation and final order creation. */
export function buildSquareOrder(request: CreateOrderRequest): SquareOrderInput {
  return {
    location_id: process.env.SQUARE_LOCATION_ID,
    pricing_options: { auto_apply_taxes: true },
    line_items: request.lineItems.map((item) => ({
      catalog_object_id: item.catalogObjectId,
      quantity: item.quantity,
    })),
    fulfillments: request.shippingAddress
      ? [{
          type: "SHIPMENT",
          state: "PROPOSED",
          shipment_details: {
            recipient: {
              display_name: `${request.shippingAddress.firstName} ${request.shippingAddress.lastName}`,
              address: {
                address_line_1: request.shippingAddress.addressLine1,
                address_line_2: request.shippingAddress.addressLine2,
                locality: request.shippingAddress.locality,
                administrative_district_level_1: request.shippingAddress.administrativeDistrictLevel1,
                postal_code: request.shippingAddress.postalCode,
                country: request.shippingAddress.country,
              },
            },
          },
        }]
      : [],
  };
}

export async function createOrder(request: CreateOrderRequest) {
  const idempotencyKey = crypto.randomUUID();

  return squareRequest("/orders", {
    method: "POST",
    body: {
      idempotency_key: idempotencyKey,
      order: {
        ...buildSquareOrder(request),
      },
    },
  });
}

interface SquareMoney {
  amount?: number;
  currency?: string;
}

export interface SquarePricedOrderData {
  id?: string;
  total_money?: SquareMoney;
  total_tax_money?: SquareMoney;
  net_amount_due_money?: SquareMoney;
}

interface SquareOrderResponse {
  order: {
    id: string;
    total_money?: SquareMoney;
    total_tax_money?: SquareMoney;
    net_amount_due_money?: SquareMoney;
    line_items?: Array<{ base_price_money?: { amount?: number }; quantity?: string }>;
  };
}

export interface PricedOrder {
  squareOrderId: string;
  subtotal: number; // cents
  tax: number; // cents
  total: number; // cents (Square-authoritative, incl tax)
  currency: string;
}

export type QuotedOrder = Omit<PricedOrder, "squareOrderId">;

export function parseSquareOrderTotals(order: SquarePricedOrderData): QuotedOrder {
  const total = order.total_money?.amount ?? 0;
  const tax = order.total_tax_money?.amount ?? 0;
  return {
    subtotal: Math.max(0, total - tax),
    tax,
    total,
    currency: order.total_money?.currency ?? "USD",
  };
}

/** Calculate the final tax-inclusive amount without creating a persistent Square order. */
export async function calculatePricedSquareOrder(
  request: CreateOrderRequest
): Promise<QuotedOrder> {
  const res = (await squareRequest("/orders/calculate", {
    method: "POST",
    revalidate: 0,
    body: { order: buildSquareOrder(request) },
  })) as SquareOrderResponse;

  return parseSquareOrderTotals(res.order);
}

/**
 * Creates a Square Order so SQUARE computes price + location tax authoritatively (auto_apply_taxes).
 * We pay against this order id, so the customer is charged Square's number, not ours. Returns the
 * computed totals to persist + charge. Shipping is $0 (free-shipping policy).
 */
export async function createPricedSquareOrder(
  request: CreateOrderRequest
): Promise<PricedOrder> {
  const idempotencyKey = crypto.randomUUID();
  const res = (await squareRequest("/orders", {
    method: "POST",
    revalidate: 0,
    body: {
      idempotency_key: idempotencyKey,
      order: {
        ...buildSquareOrder(request),
      },
    },
  })) as SquareOrderResponse;

  const order = res.order;
  const totals = parseSquareOrderTotals(order);
  return {
    squareOrderId: order.id,
    ...totals,
  };
}
