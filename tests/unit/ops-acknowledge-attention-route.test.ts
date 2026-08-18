// Audit HIGH 7's other half: fulfillments.attention_at is set by the scheduled
// APLIIQ sweep and nothing clears it, so a flagged row stayed in the operations
// queue after the underlying problem was dealt with. This route is the human
// clear. It has to be ops-only, and "cleared nothing" must not read as success.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPS_COOKIE, createOpsSessionToken } from "@/lib/ops/auth";
// Type-only, so it survives the module mock below and still fails typecheck if
// the acknowledger's contract moves under this route.
import type { ApliiqAttentionAcknowledgement } from "@/lib/commerce/apliiq-webhook-events";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  acknowledge: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock("@/lib/commerce/apliiq-webhook-events", () => ({ acknowledgeApliiqAttention: mocks.acknowledge }));

import { POST } from "@/app/api/ops/orders/[id]/acknowledge-attention/route";

const acknowledgement = (over: Partial<ApliiqAttentionAcknowledgement> = {}): ApliiqAttentionAcknowledgement =>
  ({ orderId: 77, cleared: 1, reasons: ["APLIIQ is awaiting artwork"], ...over });

function call(id = "77"): Promise<Response> {
  return POST(new Request("https://afterhoursagenda.test/api/ops/orders/77/acknowledge-attention", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("ops acknowledge attention route", () => {
  beforeEach(() => {
    vi.stubEnv("AHA_OPS_SESSION_SECRET", "test-ops-secret");
    mocks.cookieValue = createOpsSessionToken();
    mocks.acknowledge.mockResolvedValue(acknowledgement());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.cookieValue = undefined;
  });

  it("is a 404 without an ops session and never clears the flag", async () => {
    mocks.cookieValue = undefined;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it("is a 404 for a forged session cookie", async () => {
    mocks.cookieValue = `${OPS_COOKIE}-forged`;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric order id before touching the order store", async () => {
    const response = await call("not-an-id");
    expect(response.status).toBe(400);
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it("rejects a zero or negative order id", async () => {
    await expect(call("0").then((r) => r.status)).resolves.toBe(400);
    await expect(call("-3").then((r) => r.status)).resolves.toBe(400);
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it("clears the flag and reports exactly what was dismissed", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true, orderId: 77, cleared: 1, reasons: ["APLIIQ is awaiting artwork"],
    });
    expect(mocks.acknowledge).toHaveBeenCalledWith(77);
  });

  it("pluralises the note and carries every retired reason", async () => {
    mocks.acknowledge.mockResolvedValue(acknowledgement({
      cleared: 2, reasons: ["APLIIQ is awaiting garment", "Quantity mismatch"],
    }));
    const payload = await call().then((response) => response.json());
    expect(payload.reasons).toEqual(["APLIIQ is awaiting garment", "Quantity mismatch"]);
    expect(payload.note).toContain("2 APLIIQ fulfillment rows");
  });

  it("surfaces a thrown acknowledge as a conflict with its message", async () => {
    mocks.acknowledge.mockRejectedValue(new Error("Production order store is unavailable."));
    const response = await call();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false, orderId: 77, error: "Production order store is unavailable.",
    });
  });

  // acknowledgeApliiqAttention is idempotent and answers 0 rather than raising.
  // That is right for it and wrong to pass on: a 200 here would send the
  // operator back to a page still showing the flag they thought they cleared.
  it("refuses to report success when nothing was flagged", async () => {
    mocks.acknowledge.mockResolvedValue(acknowledgement({ cleared: 0, reasons: [] }));
    const response = await call();
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: false, orderId: 77, cleared: 0 });
    expect(payload.error).toContain("Nothing to acknowledge");
  });
});
