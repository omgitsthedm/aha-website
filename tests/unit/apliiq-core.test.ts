import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createApliiqAuthorization, signApliiqFulfillmentPayload } from "../../lib/apliiq/auth";
import { ApliiqHttpError, createApliiqClient } from "../../lib/apliiq/client";
import {
  ApliiqValidationError,
  buildApliiqOrderPayload,
  createApliiqOrder,
  getApliiqOrder,
  isApliiqSku,
  listApliiqOrders,
  normalizeApliiqOrderTracking,
} from "../../lib/apliiq/orders";
import { normalizeApliiqFulfillmentWebhook, verifyApliiqFulfillmentWebhookSignature } from "../../lib/apliiq/webhooks";
import type { ApliiqClient } from "../../lib/apliiq/types";

const validOrder = {
  id: "square-order-uuid",
  number: "1006",
  name: "#1006",
  orderNumber: "1006",
  lineItems: [{
    id: "square-line-1",
    title: "After Hours Tee",
    quantity: 1,
    price: "45.50",
    sku: "APQ-1998244S7A1",
  }],
  shippingAddress: {
    firstName: "John",
    lastName: "Smith",
    address1: "1692 Avenue du Mont-Royal Est",
    city: "Los Angeles",
    zip: "90013",
    province: "California",
    provinceCode: "CA",
    country: "United States",
    countryCode: "US",
  },
};

describe("Apliiq authentication", () => {
  it("uses Apliiq's exact x-apliiq-auth Authorization scheme and Base64 body signature", () => {
    const rawBody = '{"id":"square-order-uuid"}';
    const timestamp = 1_700_000_000;
    const apiKey = "app-id";
    const sharedSecret = "shared-secret";
    const nonce = "nonce-1";
    const expectedSignature = createHmac("sha256", sharedSecret)
      .update(`${apiKey}${timestamp}${nonce}${Buffer.from(rawBody).toString("base64")}`)
      .digest("base64");

    expect(createApliiqAuthorization({ apiKey, sharedSecret, timestamp, nonce, rawBody }))
      .toBe(`x-apliiq-auth ${timestamp}:${expectedSignature}:${apiKey}:${nonce}`);
  });

  it("does not retry an order POST and signs exactly what it sends", async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response('{"id":567890}', { status: 200 }));
    const client = createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: fetchMock,
      clock: () => new Date("2023-11-14T22:13:20.000Z"),
      nonce: () => "nonce-1",
    });
    const body = { id: "square-order-uuid" };

    await expect(client.request("/Order", { method: "POST", body })).resolves.toEqual({ id: 567890 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.apliiq.com/v1/Order");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(body),
      headers: expect.objectContaining({
        Authorization: createApliiqAuthorization({
          apiKey: "app-id",
          sharedSecret: "shared-secret",
          timestamp: 1_700_000_000,
          nonce: "nonce-1",
          rawBody: JSON.stringify(body),
        }),
      }),
    });
  });

  it("retains a successful HTTP status without exposing failed provider bodies", async () => {
    const accepted = createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: async () => new Response('{"message":"manual review required"}', { status: 202 }),
      clock: () => new Date("2023-11-14T22:13:20.000Z"),
      nonce: () => "nonce-1",
    });
    await expect(accepted.requestWithMetadata<{ message: string }>("/Order", { method: "POST", body: {} }))
      .resolves.toEqual({ status: 202, data: { message: "manual review required" } });

    const rejected = createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: async () => new Response('{"customer_email":"private@example.com"}', { status: 401 }),
    });
    await expect(rejected.request("/Order", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApliiqHttpError);
    try {
      await rejected.request("/Order", { method: "POST", body: {} });
    } catch (error) {
      expect(error).toMatchObject({ status: 401, message: "Apliiq API request failed (HTTP 401)." });
      expect(String(error)).not.toContain("private@example.com");
    }
  });

  it("refuses to construct a client that could send credentials to another host", () => {
    const fetchMock = vi.fn();
    expect(() => createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: fetchMock,
      baseUrl: "https://example.invalid/v1",
    })).toThrow("only permits the verified Apliiq API base URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Apliiq order payloads", () => {
  it("requires valid APQ SKUs and the destination fields required by the provider", () => {
    expect(isApliiqSku("APQ-1998244S7A1")).toBe(true);
    expect(isApliiqSku("APQ-1998244S7A1-EXTRA")).toBe(false);
    expect(() => buildApliiqOrderPayload({
      ...validOrder,
      lineItems: [{ ...validOrder.lineItems[0], sku: "TEE-BLK-M" }],
      shippingAddress: { ...validOrder.shippingAddress, provinceCode: undefined },
    })).toThrow(ApliiqValidationError);
  });

  it("emits the documented create-order snake_case payload without invented fields", () => {
    expect(buildApliiqOrderPayload({ ...validOrder, shippingCode: "upgraded" })).toEqual({
      id: "square-order-uuid",
      number: "1006",
      name: "#1006",
      order_number: "1006",
      line_items: [{
        id: "square-line-1",
        title: "After Hours Tee",
        quantity: 1,
        price: "45.50",
        grams: 0,
        sku: "APQ-1998244S7A1",
      }],
      shipping_address: {
        first_name: "John",
        last_name: "Smith",
        address1: "1692 Avenue du Mont-Royal Est",
        city: "Los Angeles",
        zip: "90013",
        province: "California",
        province_code: "CA",
        country: "United States",
        country_code: "US",
      },
      shipping_lines: [{ code: "upgraded" }],
    });
  });

  it("omits shipping_lines so Apliiq applies its documented standard default", () => {
    const payload = buildApliiqOrderPayload(validOrder);
    expect(payload.shipping_lines).toBeUndefined();
  });

  it("preserves the difference between processed and accepted create-order responses", async () => {
    const processed = createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: async () => new Response('{"id":567890}', { status: 200 }),
      clock: () => new Date("2023-11-14T22:13:20.000Z"),
      nonce: () => "nonce-1",
    });
    const accepted = createApliiqClient({
      apiKey: "app-id",
      sharedSecret: "shared-secret",
      fetch: async () => new Response('{"message":"address review"}', { status: 202 }),
      clock: () => new Date("2023-11-14T22:13:20.000Z"),
      nonce: () => "nonce-2",
    });

    await expect(createApliiqOrder(processed, validOrder)).resolves.toEqual({
      status: 200,
      outcome: "processed",
      response: { id: 567890 },
    });
    await expect(createApliiqOrder(accepted, validOrder)).resolves.toEqual({
      status: 202,
      outcome: "accepted",
      response: { message: "address review" },
    });
  });

  it("uses the documented order-detail and order-list paths", async () => {
    const paths: string[] = [];
    const client: ApliiqClient = {
      request: async <T>(endpoint: string) => {
        paths.push(endpoint);
        return [] as T;
      },
      requestWithMetadata: async <T>() => ({ status: 200, data: [] as T }),
    };
    await getApliiqOrder(client, "123/456");
    await listApliiqOrders(client, 2026);
    expect(paths).toEqual(["/Order/123%2F456", "/Order?yearOrlastNoMonth=2026"]);
  });
});

describe("Apliiq fulfillment webhooks", () => {
  it("verifies the header against the unparsed raw body", () => {
    const rawBody = '{\n  "fulfillment": { "status": "success" }\n}';
    const sharedSecret = "shared-secret";
    const signature = signApliiqFulfillmentPayload(rawBody, sharedSecret);

    expect(verifyApliiqFulfillmentWebhookSignature({ rawBody, signature, sharedSecret })).toBe(true);
    expect(verifyApliiqFulfillmentWebhookSignature({ rawBody: JSON.stringify(JSON.parse(rawBody)), signature, sharedSecret })).toBe(false);
  });

  it("keeps unknown status unknown and accepts only HTTPS tracking links", () => {
    expect(normalizeApliiqFulfillmentWebhook({
      fulfillment: {
        status: "awaiting review",
        tracking_company: "USPS",
        tracking_numbers: ["9400", "9400", 12],
        tracking_urls: ["https://tools.usps.com/track/9400", "http://untrusted.example/9400"],
      },
    })).toEqual({
      status: "unknown",
      carrier: "USPS",
      trackingNumbers: ["9400"],
      trackingUrls: ["https://tools.usps.com/track/9400"],
    });

    expect(normalizeApliiqOrderTracking({
      Status: "Shipped",
      SN: [{ Carrier: "https://tools.usps.com/track/9400", TrackingNumber: "9400" }],
    })).toEqual({
      status: "shipped",
      trackingNumbers: ["9400"],
      trackingUrls: ["https://tools.usps.com/track/9400"],
    });
    expect(normalizeApliiqOrderTracking({ Status: "On Hold" }).status).toBe("attention");
    expect(normalizeApliiqOrderTracking({ Status: "Payment Pending" }).status).toBe("attention");
  });
});
