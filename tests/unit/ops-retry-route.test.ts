// The ops "Retry fulfillment" button. Its failure mode was silence: a gate-held
// APLIIQ claim makes startApliiqFulfillment return without writing, throwing or
// submitting, so the route answered 303 and the operator saw an unchanged page
// forever. Retry must now report the hold, and must still redirect when it
// genuinely ran.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPS_COOKIE, createOpsSessionToken } from "@/lib/ops/auth";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  configured: vi.fn(() => true),
  claimLookup: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock("@/lib/db/client", () => ({
  isDbConfigured: mocks.configured,
  db: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => mocks.claimLookup() }) }) }),
  }),
}));

vi.mock("@/lib/commerce/reconciliation", () => ({ retryOrderFulfillment: mocks.retry }));

import { POST } from "@/app/api/ops/orders/[id]/retry/route";

function call(id = "77"): Promise<Response> {
  return POST(new Request("https://afterhoursagenda.test/api/ops/orders/77/retry", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("ops retry fulfillment route", () => {
  beforeEach(() => {
    vi.stubEnv("AHA_OPS_SESSION_SECRET", "test-ops-secret");
    mocks.cookieValue = createOpsSessionToken();
    mocks.configured.mockReturnValue(true);
    mocks.retry.mockResolvedValue(undefined);
    // Default: the claim moved, so there is no held row left to report.
    mocks.claimLookup.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.cookieValue = undefined;
  });

  it("is a 404 without an ops session and never runs the retry", async () => {
    mocks.cookieValue = undefined;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("is a 404 for a forged session cookie", async () => {
    mocks.cookieValue = `${OPS_COOKIE}-forged`;
    const response = await call();
    expect(response.status).toBe(404);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric order id before touching the order store", async () => {
    const response = await call("not-an-id");
    expect(response.status).toBe(400);
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("redirects back to /ops when the retry actually moved the claim", async () => {
    const response = await call();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://afterhoursagenda.test/ops");
    expect(mocks.retry).toHaveBeenCalledWith(77);
  });

  it("surfaces a thrown retry as a conflict with its message", async () => {
    mocks.retry.mockRejectedValue(new Error("Only paid orders can enter fulfillment."));
    const response = await call();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false, orderId: 77, error: "Only paid orders can enter fulfillment.",
    });
  });

  // The residual the judge reproduced: retry on a held row was a silent no-op.
  it("reports the hold instead of a silent 303 when the APLIIQ claim did not move", async () => {
    mocks.claimLookup.mockResolvedValue([
      { status: "manual_review", lastError: "APLIIQ order submission is disabled by server-side production gates." },
    ]);

    const response = await call();

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: false,
      orderId: 77,
      declined: "apliiq_hold",
      status: "manual_review",
      holdReason: "APLIIQ order submission is disabled by server-side production gates.",
      releaseEndpoint: "/api/ops/orders/77/apliiq-resubmit",
    });
    // The operator has to be told which action DOES clear this, by name.
    expect(payload.error).toContain("Release APLIIQ hold");
    expect(payload.error).toContain("/api/ops/orders/77/apliiq-resubmit");
    expect(payload.error).toContain("disabled by server-side production gates");
  });

  it("still reports the hold when the held row carries no lastError", async () => {
    mocks.claimLookup.mockResolvedValue([{ status: "manual_review", lastError: null }]);
    const response = await call();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ declined: "apliiq_hold", holdReason: null });
  });

  it("skips the hold check when the order store is not configured", async () => {
    mocks.configured.mockReturnValue(false);
    const response = await call();
    expect(response.status).toBe(303);
    expect(mocks.claimLookup).not.toHaveBeenCalled();
  });

  it("does not turn a retry that ran into a failure when the hold check itself errors", async () => {
    mocks.claimLookup.mockRejectedValue(new Error("connection terminated"));
    const response = await call();
    expect(response.status).toBe(303);
    expect(mocks.retry).toHaveBeenCalledWith(77);
  });
});
