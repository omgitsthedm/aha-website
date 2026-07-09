import { squareRequest } from "./client";

interface LineItem {
  catalogObjectId: string;
  quantity: string;
}

interface CreateOrderRequest {
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

export async function createOrder(request: CreateOrderRequest) {
  const idempotencyKey = crypto.randomUUID();

  return squareRequest("/orders", {
    method: "POST",
    body: {
      idempotency_key: idempotencyKey,
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        line_items: request.lineItems.map((item) => ({
          catalog_object_id: item.catalogObjectId,
          quantity: item.quantity,
        })),
        fulfillments: request.shippingAddress
          ? [
              {
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
              },
            ]
          : [],
      },
    },
  });
}

interface SquareOrderResponse {
  order: {
    id: string;
    total_money?: { amount?: number; currency?: string };
    total_tax_money?: { amount?: number };
    net_amount_due_money?: { amount?: number };
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
        location_id: process.env.SQUARE_LOCATION_ID,
        pricing_options: { auto_apply_taxes: true },
        line_items: request.lineItems.map((item) => ({
          catalog_object_id: item.catalogObjectId,
          quantity: item.quantity,
        })),
        fulfillments: request.shippingAddress
          ? [
              {
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
              },
            ]
          : [],
      },
    },
  })) as SquareOrderResponse;

  const order = res.order;
  const total = order.total_money?.amount ?? 0;
  const tax = order.total_tax_money?.amount ?? 0;
  return {
    squareOrderId: order.id,
    subtotal: Math.max(0, total - tax),
    tax,
    total,
    currency: order.total_money?.currency ?? "USD",
  };
}
