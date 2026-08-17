import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signApliiqFulfillmentPayload } from "@/lib/apliiq/auth";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  apply: vi.fn(),
  record: vi.fn(),
  processed: vi.fn(),
  failed: vi.fn(),
  claim: vi.fn(),
}));

vi.mock("@/lib/commerce/apliiq-webhook-events", () => ({
  parseApliiqFulfillmentEvent: mocks.parse,
  applyApliiqFulfillmentEvent: mocks.apply,
}));

vi.mock("@/lib/commerce/webhooks", () => ({
  recordWebhookEvent: mocks.record,
  markWebhookProcessed: mocks.processed,
  markWebhookFailed: mocks.failed,
  claimWebhookEvent: mocks.claim,
}));

vi.mock("@/lib/commerce/checkout-alert", () => ({ reportCheckoutError: vi.fn() }));

import { POST } from "@/app/api/webhooks/apliiq/fulfillment/route";

const secret = "test-apliiq-webhook-secret";
const rawBody = '{"fulfillment":{"order_id":"apliiq-order-1","status":"Shipped"}}';

function signedRequest(body = rawBody, signature = signApliiqFulfillmentPayload(body, secret)): Request {
  return new Request("https://afterhoursagenda.test/api/webhooks/apliiq", {
    method: "POST",
    headers: { "x-apliiq-hmac": signature },
    body,
  });
}

describe("APLIIQ webhook route", () => {
  beforeEach(() => {
    vi.stubEnv("APLIIQ_SHARED_SECRET", secret);
    mocks.parse.mockReturnValue({ reference: { providerOrderId: "apliiq-order-1" } });
    mocks.record.mockResolvedValue({ isNew: true, eventRecordId: 42, processingStatus: "received" });
    mocks.apply.mockResolvedValue({ outcome: "held" });
    mocks.claim.mockResolvedValue(true);
    mocks.processed.mockResolvedValue(undefined);
    mocks.failed.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mocks.parse.mockReset();
    mocks.apply.mockReset();
    mocks.record.mockReset();
    mocks.processed.mockReset();
    mocks.failed.mockReset();
    mocks.claim.mockReset();
  });

  it("fails closed before parsing or recording when the signature is invalid", async () => {
    const response = await POST(signedRequest(rawBody, "invalid"));

    expect(response.status).toBe(401);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is absent", async () => {
    vi.stubEnv("APLIIQ_SHARED_SECRET", "");

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("records, dedupes, and applies a verified raw payload without any outbound request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.parse).toHaveBeenCalledWith(JSON.parse(rawBody));
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      provider: "apliiq",
      eventType: "fulfillment",
      signatureValid: true,
      rawPayload: JSON.parse(rawBody),
    }));
    expect(mocks.apply).toHaveBeenCalledOnce();
    expect(mocks.processed).toHaveBeenCalledWith(42);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reclaims a durable failed event once and returns an error when apply still fails", async () => {
    mocks.record.mockResolvedValue({ isNew: false, eventRecordId: 42, processingStatus: "failed" });
    mocks.apply.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.claim).toHaveBeenCalledWith(42);
    expect(mocks.failed).toHaveBeenCalledWith(42, expect.any(Error));
  });

  it("returns retryable failure while another lease is active", async () => {
    mocks.record.mockResolvedValue({ isNew: false, eventRecordId: 42, processingStatus: "processing" });
    mocks.claim.mockResolvedValue(false);

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.failed).not.toHaveBeenCalled();
  });

  it("acknowledges a duplicate only after its durable row is processed", async () => {
    mocks.record.mockResolvedValue({ isNew: false, eventRecordId: 42, processingStatus: "processed" });
    mocks.claim.mockResolvedValue(false);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "duplicate" });
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.failed).not.toHaveBeenCalled();
  });
});
