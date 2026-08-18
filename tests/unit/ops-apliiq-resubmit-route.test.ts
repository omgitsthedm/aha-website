// HIGH 5 route: the ops-only force-resubmit endpoint. It must be unreachable
// without an ops session, must never resubmit unless the absence proof released
// the claim, and must hand the operator the evidence rather than a redirect.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPS_COOKIE, createOpsSessionToken } from "@/lib/ops/auth";

const session = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
const mocks = vi.hoisted(() => ({ release: vi.fn(), retry: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "aha_ops_session" && session.cookie ? { value: session.cookie } : undefined),
  }),
}));

vi.mock("@/lib/commerce/fulfillment", () => ({ forceResubmitApliiqFulfillment: mocks.release }));
vi.mock("@/lib/commerce/reconciliation", () => ({ retryOrderFulfillment: mocks.retry }));

import { POST } from "@/app/api/ops/orders/[id]/apliiq-resubmit/route";

const evidence = { checkedAt: "2026-08-17T12:00:00.000Z", lookups: ["GET /Order/aha-apliiq-77 -> 404"], recordsScanned: 0 };

function call(id = "77"): Promise<Response> {
  return POST(new Request("https://afterhoursagenda.test/api/ops/orders/77/apliiq-resubmit", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("ops APLIIQ force-resubmit route", () => {
  beforeEach(() => {
    vi.stubEnv("AHA_OPS_SESSION_SECRET", "test-ops-secret");
    session.cookie = createOpsSessionToken();
    mocks.release.mockResolvedValue({ outcome: "released", providerRequestId: "aha-apliiq-77", evidence });
    mocks.retry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    session.cookie = undefined;
  });

  it("is a 404 without an ops session and never reaches the release", async () => {
    session.cookie = undefined;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("is a 404 for a forged session cookie", async () => {
    session.cookie = `${OPS_COOKIE}-forged`;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric order id before touching the order store", async () => {
    const response = await call("not-an-id");
    expect(response.status).toBe(400);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("resubmits and returns the absence evidence once the claim is released", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true, orderId: 77, providerRequestId: "aha-apliiq-77", evidence,
    });
    expect(mocks.release).toHaveBeenCalledWith(77);
    expect(mocks.retry).toHaveBeenCalledWith(77);
  });

  it("never resubmits when the release is blocked", async () => {
    mocks.release.mockResolvedValue({ outcome: "blocked", reason: "APLIIQ already holds order 550123; nothing was resubmitted.", providerOrderId: "550123" });

    const response = await call();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, providerOrderId: "550123" });
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("surfaces a thrown release as a conflict without resubmitting", async () => {
    mocks.release.mockRejectedValue(new Error("Production order store is unavailable."));

    const response = await call();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Production order store is unavailable." });
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("reports that the claim is already released when the resubmission itself fails", async () => {
    mocks.retry.mockRejectedValue(new Error("Only paid orders can enter fulfillment."));

    const response = await call();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false, released: true, providerRequestId: "aha-apliiq-77", error: "Only paid orders can enter fulfillment.",
    });
  });
});
