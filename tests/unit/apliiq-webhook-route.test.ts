import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signApliiqFulfillmentPayload } from "@/lib/apliiq/auth";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  apply: vi.fn(),
  record: vi.fn(),
  processed: vi.fn(),
  failed: vi.fn(),
  claim: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/apliiq/webhooks", () => ({
  verifyApliiqFulfillmentWebhookSignature: mocks.verify,
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

function chunkedOversizeRequest() {
  const chunkBytes = 16 * 1024;
  let producedBytes = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      producedBytes += chunkBytes;
      controller.enqueue(new Uint8Array(chunkBytes));
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  const request = new Request("https://afterhoursagenda.test/api/webhooks/apliiq", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return {
    request,
    state: () => ({ cancelled, producedBytes, chunkBytes }),
  };
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
    mocks.verify.mockReturnValue(true);
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
    mocks.verify.mockReset();
  });

  it("fails closed before parsing or recording when the signature is invalid", async () => {
    mocks.verify.mockReturnValueOnce(false);

    const response = await POST(signedRequest(rawBody, "invalid"));

    expect(response.status).toBe(401);
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized payload before reading or signature verification", async () => {
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 });
    const request = new Request("https://afterhoursagenda.test/api/webhooks/apliiq", {
      method: "POST",
      headers: { "content-length": String(512 * 1024 + 1) },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(pull).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it.each(["invalid", "-1"])("rejects malformed Content-Length %s before signature verification", async (contentLength) => {
    const response = await POST(new Request("https://afterhoursagenda.test/api/webhooks/apliiq", {
      method: "POST",
      headers: { "content-length": contentLength },
      body: "{}",
    }));

    expect(response.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("cancels a chunked payload as soon as its actual bytes exceed the limit", async () => {
    const streamed = chunkedOversizeRequest();

    const response = await POST(streamed.request);

    expect(response.status).toBe(413);
    expect(streamed.state().cancelled).toBe(true);
    expect(streamed.state().producedBytes).toBeLessThanOrEqual(512 * 1024 + streamed.state().chunkBytes);
    expect(mocks.verify).not.toHaveBeenCalled();
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

  it("preserves exact valid UTF-8 text when a multibyte character spans chunks", async () => {
    const unicodeBody = '{"fulfillment":{"order_id":"apliiq-order-1","status":"Shipped"},"note":"café"}';
    const encoded = new TextEncoder().encode(unicodeBody);
    const splitAt = new TextEncoder().encode(unicodeBody.slice(0, unicodeBody.indexOf("é"))).byteLength + 1;
    const chunks = [encoded.slice(0, splitAt), encoded.slice(splitAt)];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
    }, { highWaterMark: 0 });
    const request = new Request("https://afterhoursagenda.test/api/webhooks/apliiq", {
      method: "POST",
      headers: { "x-apliiq-hmac": signApliiqFulfillmentPayload(unicodeBody, secret) },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ rawBody: unicodeBody }));
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      rawPayload: JSON.parse(unicodeBody),
    }));
  });

  it("records, dedupes, and applies a verified raw payload without any outbound request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ rawBody }));
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
