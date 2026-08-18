// The apartment line, end to end. A NYC order without "Apt 4B" is undeliverable
// and the parcel returns to AHA at AHA's cost, so every hop between the
// checkout form and the two outbound systems is pinned here: the paid order
// snapshot, Square's shipment recipient, and APLIIQ's wire payload.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  squareRequest: vi.fn(),
  createPricedSquareOrder: vi.fn(),
  findOrCreateCustomer: vi.fn(),
  getSquareLocationId: vi.fn(),
  revalidateCart: vi.fn(),
  assertCartFulfillableToCountry: vi.fn(),
  createOrder: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderFailed: vi.fn(),
  findPaidOrderByIdempotencyKey: vi.fn(),
  startFulfillment: vi.fn(),
  enqueueOrderNotification: vi.fn(),
  dispatchOrderNotifications: vi.fn(),
  reportCheckoutError: vi.fn(),
  resolveEffectiveDiscount: vi.fn(),
}));

vi.mock("@/lib/square/client", () => ({ squareRequest: mocks.squareRequest }));
vi.mock("@/lib/square/orders", () => ({ createPricedSquareOrder: mocks.createPricedSquareOrder }));
vi.mock("@/lib/square/customers", () => ({ findOrCreateCustomer: mocks.findOrCreateCustomer }));
vi.mock("@/lib/commerce/runtime", () => ({ getSquareLocationId: mocks.getSquareLocationId }));
vi.mock("@/lib/commerce/orders", () => ({
  revalidateCart: mocks.revalidateCart,
  assertCartFulfillableToCountry: mocks.assertCartFulfillableToCountry,
  createOrder: mocks.createOrder,
  markOrderPaid: mocks.markOrderPaid,
  markOrderFailed: mocks.markOrderFailed,
  findPaidOrderByIdempotencyKey: mocks.findPaidOrderByIdempotencyKey,
}));
vi.mock("@/lib/commerce/fulfillment", () => ({ startFulfillment: mocks.startFulfillment }));
vi.mock("@/lib/commerce/notifications", () => ({
  enqueueOrderNotification: mocks.enqueueOrderNotification,
  dispatchOrderNotifications: mocks.dispatchOrderNotifications,
}));
vi.mock("@/lib/commerce/checkout-alert", () => ({ reportCheckoutError: mocks.reportCheckoutError }));
vi.mock("@/lib/commerce/discounts", () => ({ resolveEffectiveDiscount: mocks.resolveEffectiveDiscount }));

import { POST } from "@/app/api/create-payment/route";
import { buildApliiqAddress } from "@/lib/fulfillment/apliiq-adapter";
import { buildApliiqOrderPayload } from "@/lib/apliiq/orders";
import type { OrderContact } from "@/lib/commerce/orders";

const cart = {
  currency: "USD",
  subtotal: 4500,
  items: [{ squareVariationId: "SQ_VARIATION", quantity: 1, unitPrice: 4500, lineTotal: 4500 }],
};

function paymentBody(address2: unknown) {
  return {
    sourceId: "cnon:card-nonce",
    idempotencyKey: "idem-1",
    quotedTotal: 4900,
    quotedCurrency: "USD",
    lines: [{ squareVariationId: "SQ_VARIATION", quantity: 1 }],
    contact: {
      email: "customer@example.com",
      shippingName: "Taylor Customer",
      shippingAddress: {
        address1: "1 Main Street",
        ...(address2 === undefined ? {} : { address2 }),
        city: "Brooklyn",
        state: "NY",
        zip: "11201",
        country: "US",
      },
    },
  };
}

function request(address2: unknown): Request {
  return new Request("https://afterhoursagenda.test/api/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentBody(address2)),
  });
}

describe("create-payment forwards the apartment line", () => {
  beforeEach(() => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
    mocks.getSquareLocationId.mockReturnValue("LOC");
    mocks.findPaidOrderByIdempotencyKey.mockResolvedValue(null);
    mocks.revalidateCart.mockReturnValue(cart);
    mocks.assertCartFulfillableToCountry.mockReturnValue(undefined);
    mocks.resolveEffectiveDiscount.mockReturnValue(null);
    mocks.findOrCreateCustomer.mockResolvedValue("CUST_1");
    mocks.createPricedSquareOrder.mockResolvedValue({
      squareOrderId: "SQ_ORDER", subtotal: 4500, tax: 400, total: 4900, currency: "USD",
    });
    mocks.createOrder.mockResolvedValue({ orderId: 1, externalOrderNumber: "AHA-TEST-0001", total: 4900 });
    mocks.squareRequest.mockResolvedValue({ payment: { id: "PAY_1", status: "COMPLETED" } });
    mocks.markOrderPaid.mockResolvedValue(undefined);
    mocks.enqueueOrderNotification.mockResolvedValue(undefined);
    mocks.dispatchOrderNotifications.mockResolvedValue(undefined);
    mocks.startFulfillment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("sends address2 to Square as addressLine2 and keeps it in the paid snapshot", async () => {
    const response = await POST(request("Apt 4B"));
    expect(response.status).toBe(200);

    expect(mocks.createPricedSquareOrder).toHaveBeenCalledTimes(1);
    expect(mocks.createPricedSquareOrder.mock.calls[0][0].shippingAddress).toMatchObject({
      addressLine1: "1 Main Street",
      addressLine2: "Apt 4B",
      locality: "Brooklyn",
      postalCode: "11201",
    });

    // The persisted snapshot and the fulfillment hand-off must both carry it —
    // APLIIQ reads the snapshot back, not the live form.
    const persisted = mocks.createOrder.mock.calls[0][1] as OrderContact;
    expect(persisted.shippingAddress?.address2).toBe("Apt 4B");
    const dispatched = mocks.startFulfillment.mock.calls[0][2] as OrderContact;
    expect(dispatched.shippingAddress?.address2).toBe("Apt 4B");
  });

  it("trims the apartment line and omits it when the shopper left it blank", async () => {
    await POST(request("  Suite 900  "));
    expect(mocks.createPricedSquareOrder.mock.calls[0][0].shippingAddress.addressLine2).toBe("Suite 900");

    mocks.createPricedSquareOrder.mockClear();
    await POST(request(""));
    expect(mocks.createPricedSquareOrder.mock.calls[0][0].shippingAddress).not.toHaveProperty("addressLine2");

    mocks.createPricedSquareOrder.mockClear();
    await POST(request(undefined));
    expect(mocks.createPricedSquareOrder.mock.calls[0][0].shippingAddress).not.toHaveProperty("addressLine2");
  });

  it("ignores a non-string address2 instead of putting it on a shipping label", async () => {
    await POST(request({ injected: true }));
    expect(mocks.createPricedSquareOrder.mock.calls[0][0].shippingAddress).not.toHaveProperty("addressLine2");
  });
});

describe("the apartment line survives the APLIIQ hop", () => {
  const contact: OrderContact = {
    email: "customer@example.com",
    shippingName: "Taylor Customer",
    shippingAddress: {
      address1: "1 Main Street",
      address2: "Apt 4B",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
      country: "US",
    },
  };

  it("puts address2 on the APLIIQ wire payload", () => {
    expect(buildApliiqAddress(contact).address2).toBe("Apt 4B");

    const payload = buildApliiqOrderPayload({
      id: "req-1",
      number: "AHA-TEST-0001",
      name: "AHA-TEST-0001",
      orderNumber: "AHA-TEST-0001",
      lineItems: [{ id: "req-1:1", title: "After Hours Tee", quantity: 1, price: "45.00", sku: "APQ-1998244S7A1" }],
      shippingAddress: buildApliiqAddress(contact),
    });
    expect(payload.shipping_address.address2).toBe("Apt 4B");
  });

  it("accepts the snake_case snapshot key and omits an empty unit", () => {
    expect(buildApliiqAddress({
      ...contact,
      shippingAddress: { ...contact.shippingAddress, address2: undefined, address_2: "Floor 3" },
    }).address2).toBe("Floor 3");
    expect(buildApliiqAddress({
      ...contact,
      shippingAddress: { ...contact.shippingAddress, address2: "   " },
    })).not.toHaveProperty("address2");
  });
});
