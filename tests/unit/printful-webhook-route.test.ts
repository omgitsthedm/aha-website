import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  record: vi.fn(),
  apply: vi.fn(),
  processed: vi.fn(),
  failed: vi.fn(),
}));

vi.mock("@/lib/commerce/runtime", () => ({ getFulfillmentMode: () => "manual" }));
vi.mock("@/lib/printful/webhooks", () => ({ verifyPrintfulWebhookSignature: mocks.verify }));
vi.mock("@/lib/commerce/checkout-alert", () => ({ reportCheckoutError: vi.fn() }));
vi.mock("@/lib/commerce/webhooks", () => ({
  recordWebhookEvent: mocks.record,
  applyPrintfulEvent: mocks.apply,
  markWebhookProcessed: mocks.processed,
  markWebhookFailed: mocks.failed,
}));

import { POST } from "@/app/api/webhooks/printful/route";

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
  const request = new Request("https://afterhoursagenda.test/api/webhooks/printful", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return {
    request,
    state: () => ({ cancelled, producedBytes, chunkBytes }),
  };
}

describe("Printful webhook route", () => {
  beforeEach(() => {
    mocks.verify.mockReset();
    mocks.record.mockReset();
    mocks.apply.mockReset();
    mocks.processed.mockReset();
    mocks.failed.mockReset();
  });
  it("rejects a declared oversized payload before reading or signature verification", async () => {
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 });
    const request = new Request("https://afterhoursagenda.test/api/webhooks/printful", {
      method: "POST",
      headers: { "content-length": String(512 * 1024 + 1) },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(pull).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it.each(["invalid", "-1"])("rejects malformed Content-Length %s before signature verification", async (contentLength) => {
    const response = await POST(new Request("https://afterhoursagenda.test/api/webhooks/printful", {
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
});
