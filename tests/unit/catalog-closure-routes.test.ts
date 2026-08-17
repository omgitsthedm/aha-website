import { afterEach, describe, expect, it, vi } from "vitest";

const {
  captureAbandonedCart,
  dispatchAbandonedCarts,
  dispatchReviewRequests,
  dispatchWinback,
} = vi.hoisted(() => ({
  captureAbandonedCart: vi.fn(),
  dispatchAbandonedCarts: vi.fn(),
  dispatchReviewRequests: vi.fn(),
  dispatchWinback: vi.fn(),
}));
const previousCronSecret = process.env.CRON_SECRET;

vi.mock("@/lib/commerce/abandoned-cart", () => ({
  captureAbandonedCart,
  dispatchAbandonedCarts,
}));
vi.mock("@/lib/commerce/review-request", () => ({ dispatchReviewRequests }));
vi.mock("@/lib/commerce/winback", () => ({ dispatchWinback }));

afterEach(() => {
  vi.clearAllMocks();
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousCronSecret;
});

describe("closed-catalog lifecycle routes", () => {
  it("rejects abandoned-cart capture before parsing or persistence", async () => {
    const { POST } = await import("@/app/api/checkout/capture/route");
    const response = await POST(new Request("https://afterhoursagenda.test/api/checkout/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer@example.com",
        items: [{ title: "Retired item", quantity: 1, lineTotal: 4200 }],
        subtotal: 4200,
      }),
    }));

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "CATALOG_MIGRATION_IN_PROGRESS",
    });
    expect(captureAbandonedCart).not.toHaveBeenCalled();
  });

  it("skips every lifecycle campaign before database or email dispatch", async () => {
    process.env.CRON_SECRET = "catalog-reset-test";
    const { POST } = await import("@/app/api/cron/lifecycle/route");
    const response = await POST(new Request("https://afterhoursagenda.test/api/cron/lifecycle", {
      method: "POST",
      headers: { Authorization: "Bearer catalog-reset-test" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: "catalog_closed" });
    expect(dispatchAbandonedCarts).not.toHaveBeenCalled();
    expect(dispatchReviewRequests).not.toHaveBeenCalled();
    expect(dispatchWinback).not.toHaveBeenCalled();
  });
});
