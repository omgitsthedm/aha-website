import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpsSessionToken } from "@/lib/ops/auth";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  configured: vi.fn(() => true),
  reconcile: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock("@/lib/db/client", () => ({ isDbConfigured: mocks.configured, db: () => ({}) }));

// Only the persistence entry point is stubbed; calculateProviderRecoveryCents
// stays real so the route's tier arithmetic is exercised end to end.
vi.mock("@/lib/commerce/webhooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/commerce/webhooks")>()),
  reconcileRefundProviderLeg: mocks.reconcile,
}));

import { POST } from "@/app/api/ops/refunds/[refundId]/reconcile/route";

const previousSecret = process.env.AHA_OPS_SESSION_SECRET;

function post(body: unknown, refundId = "refund-1") {
  return POST(
    new Request(`https://afterhoursagenda.test/api/ops/refunds/${refundId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ refundId }) },
  );
}

const applied = {
  applied: true,
  orderId: 7,
  refundAuditLogId: 31,
  previous: { providerRecoveryTier: null, recoveredAmountCents: null },
  stored: { providerRecoveryTier: "post_garment", recoveredAmountCents: 1041 },
  audited: true,
};

beforeEach(() => {
  process.env.AHA_OPS_SESSION_SECRET = "test-ops-session-secret";
  mocks.cookieValue = createOpsSessionToken();
  mocks.configured.mockReturnValue(true);
  mocks.reconcile.mockResolvedValue(applied);
});

afterEach(() => {
  vi.clearAllMocks();
  if (previousSecret === undefined) delete process.env.AHA_OPS_SESSION_SECRET;
  else process.env.AHA_OPS_SESSION_SECRET = previousSecret;
});

describe("ops refund reconcile authentication", () => {
  it("404s without a valid ops session and never touches the ledger", async () => {
    mocks.cookieValue = undefined;
    expect((await post({ recoveryTier: "post_print", shippingCents: 596 })).status).toBe(404);

    mocks.cookieValue = "v2.9999999999999.forged";
    expect((await post({ recoveryTier: "post_print", shippingCents: 596 })).status).toBe(404);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});

describe("ops refund reconcile validation", () => {
  it("rejects a bad body, a missing tier and an unknown tier", async () => {
    expect((await post("not-json")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ recoveryTier: "post_pizza", shippingCents: 0 })).status).toBe(400);
    expect((await post({ recoveryTier: "post_print", shippingCents: 0, outcome: "sideways" })).status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("rejects fractional and negative cent amounts", async () => {
    for (const body of [
      { recoveryTier: "post_print", shippingCents: -1 },
      { recoveryTier: "post_print", productCents: 10.5, shippingCents: 0 },
      { recoveryTier: "post_print", recoveredAmountCents: -5 },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("503s when the order store is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await post({ recoveryTier: "post_print", shippingCents: 596 })).status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("refuses to model a recovery it cannot compute, so 0 always means 'recovered nothing'", async () => {
    expect((await post({ recoveryTier: "post_garment" })).status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("refuses to model a cancellation that was never attempted", async () => {
    const response = await post({
      recoveryTier: "post_garment", outcome: "not_attempted", productCents: 2225, shippingCents: 596,
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("recoveredAmountCents is required");

    // With the receipt in hand it is a legitimate close-out.
    mocks.reconcile.mockResolvedValue({ ...applied, stored: { providerRecoveryTier: "post_garment", recoveredAmountCents: 0 } });
    expect((await post({ recoveryTier: "post_garment", outcome: "not_attempted", recoveredAmountCents: 0 })).status).toBe(200);
  });

  it("will not overwrite a booked figure without a written reason", async () => {
    const response = await post({ recoveryTier: "post_print", shippingCents: 596, allowOverwrite: true });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("note is required");
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});

describe("ops refund reconcile arithmetic", () => {
  const providerCosts = { productCents: 2225, shippingCents: 596 };

  it("models each APLIIQ cancellation tier the same way the refund route does", async () => {
    // 596 shipping + 20% of 2225 = 1041, the figure the judge watched vanish.
    const expected: Record<string, number> = { pre_garment: 2821, post_garment: 1041, post_print: 596 };
    for (const [recoveryTier, recoveredAmountCents] of Object.entries(expected)) {
      mocks.reconcile.mockClear();
      await post({ recoveryTier, ...providerCosts });
      expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({
        squareRefundId: "refund-1", providerRecoveryTier: recoveryTier, recoveredAmountCents, actor: "ops",
      }));
    }
  });

  it("lets the provider receipt override the modelled amount", async () => {
    await post({ recoveryTier: "post_garment", ...providerCosts, recoveredAmountCents: 900 });
    expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({ recoveredAmountCents: 900 }));
  });

  // Next decodes the segment before it reaches the handler, so the route takes
  // the id exactly as given and never re-decodes it into a different refund.
  it("passes the refund id straight through from the path", async () => {
    await post({ recoveryTier: "post_print", shippingCents: 596 }, "rf%2F1");
    expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({ squareRefundId: "rf%2F1" }));
  });
});

describe("ops refund reconcile outcomes", () => {
  it("answers with what the ledger stored, not with what was asked for", async () => {
    mocks.reconcile.mockResolvedValue({ ...applied, stored: { providerRecoveryTier: "post_print", recoveredAmountCents: 596 } });

    const response = await post({ recoveryTier: "post_garment", productCents: 2225, shippingCents: 596 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, applied: true, orderId: 7,
      providerRecoveryTier: "post_print", recoveredAmountCents: 596,
      previous: { providerRecoveryTier: null, recoveredAmountCents: null },
    });
  });

  it("treats a repeat of the same reconciliation as success", async () => {
    mocks.reconcile.mockResolvedValue({
      applied: false, reason: "unchanged", orderId: 7,
      current: { providerRecoveryTier: "post_garment", recoveredAmountCents: 1041 },
    });

    const response = await post({ recoveryTier: "post_garment", productCents: 2225, shippingCents: 596 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, applied: false, reason: "unchanged", recoveredAmountCents: 1041,
    });
  });

  it("409s a conflicting figure and names the way through", async () => {
    mocks.reconcile.mockResolvedValue({
      applied: false, reason: "already_reconciled", orderId: 7,
      current: { providerRecoveryTier: "post_print", recoveredAmountCents: 596 },
    });

    const response = await post({ recoveryTier: "post_garment", productCents: 2225, shippingCents: 596 });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, reason: "already_reconciled", current: { recoveredAmountCents: 596 } });
    expect(body.error).toContain("allowOverwrite");
  });

  it("409s a lost race rather than claiming the write landed", async () => {
    mocks.reconcile.mockResolvedValue({ applied: false, reason: "raced", orderId: 7, current: null });
    expect((await post({ recoveryTier: "post_print", shippingCents: 596 })).status).toBe(409);
  });

  it("404s a refund the ledger has never booked", async () => {
    mocks.reconcile.mockResolvedValue({ applied: false, reason: "refund_not_found", orderId: null, current: null });

    const response = await post({ recoveryTier: "post_print", shippingCents: 596 });

    expect(response.status).toBe(404);
    expect((await response.json()).error).toContain("refund webhook");
  });

  it("surfaces a store outage from the reconciler as a 503", async () => {
    mocks.reconcile.mockResolvedValue({ applied: false, reason: "db_unavailable", orderId: null, current: null });
    expect((await post({ recoveryTier: "post_print", shippingCents: 596 })).status).toBe(503);
  });

  it("says so out loud when the money was booked but the trail was not", async () => {
    mocks.reconcile.mockResolvedValue({ ...applied, audited: false });

    const response = await post({ recoveryTier: "post_garment", productCents: 2225, shippingCents: 596 });

    const body = await response.json();
    expect(body).toMatchObject({ ok: true, applied: true, audited: false });
    expect(body.note).toContain("trail");
  });

  it("forwards the override and its note to the reconciler", async () => {
    await post({
      recoveryTier: "post_garment", recoveredAmountCents: 1041,
      allowOverwrite: true, note: "APLIIQ credit memo 88213",
    });
    expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({
      allowOverwrite: true, note: "APLIIQ credit memo 88213", providerOutcome: "refunded",
    }));
  });
});
