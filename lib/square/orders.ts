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
