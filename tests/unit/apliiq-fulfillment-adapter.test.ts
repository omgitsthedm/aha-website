import { describe, expect, it, vi } from "vitest";

import {
  buildApliiqFulfillmentOrder,
  getApliiqDefaultShipping,
  isApliiqSubmissionAllowed,
  submitApliiqFulfillment,
} from "@/lib/fulfillment/apliiq-adapter";
import { buildApliiqOrderPayload } from "@/lib/apliiq/orders";
import { groupItemsByFulfillmentProvider } from "@/lib/fulfillment/provider-dispatcher";
import type { ApliiqClient } from "@/lib/apliiq/types";
import type { RevalidatedItem } from "@/lib/commerce/orders";

function item(provider: "printful" | "apliiq", overrides: Partial<RevalidatedItem> = {}): RevalidatedItem {
  return {
    ahaProductId: "tee",
    ahaVariantId: "tee-black-m",
    sku: "AHA-TEE-M",
    title: "After Hours Tee",
    size: "M",
    quantity: 2,
    unitPrice: 4550,
    lineTotal: 9100,
    squareVariationId: "square-variation",
    fulfillmentProvider: provider,
    providerVariantId: provider === "apliiq" ? "apliiq-variant" : "123",
    providerSku: provider === "apliiq" ? "APQ-1998244S7A1" : "AHA-TEE-M",
    providerSnapshot: provider === "apliiq"
      ? {
        apliiqSku: "APQ-1998244S7A1",
        mappingApproval: "approved",
        sampleApproval: "approved",
        decoration: { front: { artworkId: "front-art" } },
        privateLabel: { neck: { artworkId: "neck-art" } },
      }
      : { printfulStoreId: 42 },
    ...(provider === "printful" ? { printfulStoreId: 42, printfulSyncVariantId: 123 } : {}),
    ...overrides,
  };
}

const contact = {
  email: "customer@example.com",
  shippingName: "Taylor Customer",
  shippingAddress: {
    address1: "1 Main Street",
    city: "New York",
    state: "NY",
    country: "US",
    zip: "10001",
  },
};

const liveEnvironment = {
  context: "production",
  squareEnvironment: "production",
  fulfillmentMode: "auto",
  allowCreateOrders: "true",
  liveMode: "true",
} as const;

function enableLiveSubmission(): void {
  vi.stubEnv("CONTEXT", "production");
  vi.stubEnv("SQUARE_ENVIRONMENT", "production");
  vi.stubEnv("AHA_FULFILLMENT_MODE", "auto");
  vi.stubEnv("APLIIQ_ALLOW_CREATE_ORDERS", "true");
  vi.stubEnv("APLIIQ_LIVE_MODE", "true");
}

describe("provider-neutral fulfillment dispatch", () => {
  it("groups only by the immutable line provider, not a live catalog lookup", () => {
    const groups = groupItemsByFulfillmentProvider([item("printful"), item("apliiq")]);
    expect(groups.printful).toHaveLength(1);
    expect(groups.apliiq).toHaveLength(1);
    expect(groups.apliiq[0].providerSku).toBe("APQ-1998244S7A1");
  });

  it("keeps APLIIQ submission fail-closed until every production rail is exact", () => {
    expect(isApliiqSubmissionAllowed({})).toBe(false);
    expect(isApliiqSubmissionAllowed({ ...liveEnvironment, context: "deploy-preview" })).toBe(false);
    expect(isApliiqSubmissionAllowed({ ...liveEnvironment, squareEnvironment: "sandbox" })).toBe(false);
    expect(isApliiqSubmissionAllowed({ ...liveEnvironment, fulfillmentMode: "manual" })).toBe(false);
    expect(isApliiqSubmissionAllowed({ ...liveEnvironment, allowCreateOrders: "false" })).toBe(false);
    expect(isApliiqSubmissionAllowed({ ...liveEnvironment, liveMode: "false" })).toBe(false);
    expect(isApliiqSubmissionAllowed(liveEnvironment)).toBe(true);
  });
});

describe("APLIIQ fulfillment adapter", () => {
  const request = {
    orderId: 42,
    externalOrderNumber: "AHA-ORDER-42",
    providerRequestId: "aha-apliiq-42",
    contact,
    items: [item("apliiq")],
  } as const;

  it("builds a deterministic provider request from purchase-time data", () => {
    expect(buildApliiqOrderPayload(buildApliiqFulfillmentOrder(request))).toMatchObject({
      id: "aha-apliiq-42",
      number: "AHA-ORDER-42",
      order_number: "AHA-ORDER-42",
      line_items: [{ id: "aha-apliiq-42:1", quantity: 2, price: "45.50", sku: "APQ-1998244S7A1" }],
      shipping_address: {
        first_name: "Taylor",
        last_name: "Customer",
        province: "NY",
        province_code: "NY",
        country: "United States",
        country_code: "US",
      },
      shipping_lines: [{ code: "standard" }],
    });
  });

  it("uses standard by default and validates a configured APLIIQ shipping code", () => {
    expect(getApliiqDefaultShipping(undefined)).toBe("standard");
    expect(getApliiqDefaultShipping("rush")).toBe("rush");
    expect(() => getApliiqDefaultShipping("overnight")).toThrow("APLIIQ_DEFAULT_SHIPPING");
  });

  it("rejects a line whose immutable approval or decoration evidence was lost", () => {
    expect(() => buildApliiqFulfillmentOrder({
      ...request,
      items: [item("apliiq", { providerSnapshot: { apliiqSku: "APQ-1998244S7A1" } })],
    })).toThrow("approved mapping and sample evidence");
  });

  it("does not send a mixed-provider batch to APLIIQ", () => {
    expect(() => buildApliiqFulfillmentOrder({ ...request, items: [item("printful")] }))
      .toThrow("non-APLIIQ purchase snapshot");
  });

  it("preserves accepted outcomes for manual attention without retrying POST", async () => {
    const requestWithMetadata = vi.fn(async <T>() => ({
      status: 202 as const,
      data: { message: "address review" } as T,
    }));
    const client = {
      request: async <T>() => undefined as T,
      requestWithMetadata,
    } as unknown as ApliiqClient;
    enableLiveSubmission();
    try {
      await expect(submitApliiqFulfillment(client, request)).resolves.toEqual({
        outcome: "accepted", attentionReason: "address review",
      });
      expect(requestWithMetadata).toHaveBeenCalledTimes(1);
      expect(requestWithMetadata).toHaveBeenCalledWith("/Order", expect.objectContaining({ method: "POST" }));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("requires a provider order id for a processed response", async () => {
    const client = {
      request: async <T>() => undefined as T,
      requestWithMetadata: vi.fn(async <T>() => ({ status: 200 as const, data: {} as T })),
    } as unknown as ApliiqClient;
    enableLiveSubmission();
    try {
      await expect(submitApliiqFulfillment(client, request)).rejects.toThrow("without returning an order id");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("normalizes a numeric processed order id for provider persistence", async () => {
    const client = {
      request: async <T>() => undefined as T,
      requestWithMetadata: vi.fn(async <T>() => ({ status: 200 as const, data: { id: 567890 } as T })),
    } as unknown as ApliiqClient;
    enableLiveSubmission();
    try {
      await expect(submitApliiqFulfillment(client, request)).resolves.toEqual({
        outcome: "processed", providerOrderId: "567890",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not invoke a client unless the server-side live flag is exact", async () => {
    const requestWithMetadata = vi.fn();
    const client = {
      request: async <T>() => undefined as T,
      requestWithMetadata,
    } as unknown as ApliiqClient;
    enableLiveSubmission();
    vi.stubEnv("APLIIQ_LIVE_MODE", "false");
    try {
      await expect(submitApliiqFulfillment(client, request)).rejects.toThrow("APLIIQ_LIVE_MODE=true");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(requestWithMetadata).not.toHaveBeenCalled();
  });

  it("enforces every production gate inside the submitter before a POST", async () => {
    const blockedRails = [
      ["CONTEXT", "deploy-preview"],
      ["SQUARE_ENVIRONMENT", "sandbox"],
      ["AHA_FULFILLMENT_MODE", "manual"],
      ["APLIIQ_ALLOW_CREATE_ORDERS", "false"],
      ["APLIIQ_LIVE_MODE", "false"],
    ] as const;
    for (const [name, value] of blockedRails) {
      const requestWithMetadata = vi.fn();
      const client = {
        request: async <T>() => undefined as T,
        requestWithMetadata,
      } as unknown as ApliiqClient;
      enableLiveSubmission();
      vi.stubEnv(name, value);
      await expect(submitApliiqFulfillment(client, request)).rejects.toThrow("APLIIQ order submission requires");
      expect(requestWithMetadata).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    }
  });
});
