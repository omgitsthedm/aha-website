import { afterEach, describe, expect, it, vi } from "vitest";

const {
  reconcilePaidOrders,
  sweepStalledApliiqFulfillments,
  dispatchOrderNotifications,
  lifecycleFetch,
} = vi.hoisted(() => ({
  reconcilePaidOrders: vi.fn(),
  sweepStalledApliiqFulfillments: vi.fn(),
  dispatchOrderNotifications: vi.fn(),
  lifecycleFetch: vi.fn(),
}));

vi.mock("@/lib/commerce/reconciliation", () => ({
  reconcilePaidOrders,
  sweepStalledApliiqFulfillments,
}));
vi.mock("@/lib/commerce/notifications", () => ({ dispatchOrderNotifications }));

import reconcileOrders from "../../netlify/functions/reconcile-orders";
import dispatchOrderEmail from "../../netlify/functions/dispatch-order-email";
import lifecycleCron from "../../netlify/functions/lifecycle-cron";

function schedulerRequest(path: string) {
  return new Request(`https://afterhoursagenda.com/.netlify/functions/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ next_run: "2026-09-28T00:00:00.000Z" }),
  });
}

afterEach(() => {
  delete process.env.AHA_AUTOMATIONS_ENABLED;
  delete process.env.CRON_SECRET;
  reconcilePaidOrders.mockReset();
  sweepStalledApliiqFulfillments.mockReset();
  dispatchOrderNotifications.mockReset();
  lifecycleFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("dormant automation handlers", () => {
  it("returns 204 and makes no provider calls for scheduler-shaped requests by default", async () => {
    vi.stubGlobal("fetch", lifecycleFetch);

    const results = await Promise.all([
      reconcileOrders(schedulerRequest("reconcile-orders")),
      dispatchOrderEmail(schedulerRequest("dispatch-order-email")),
      lifecycleCron(schedulerRequest("lifecycle-cron")),
    ]);

    expect(results.map((result) => result.status)).toEqual([204, 204, 204]);
    expect(reconcilePaidOrders).not.toHaveBeenCalled();
    expect(sweepStalledApliiqFulfillments).not.toHaveBeenCalled();
    expect(dispatchOrderNotifications).not.toHaveBeenCalled();
    expect(lifecycleFetch).not.toHaveBeenCalled();
  });
});
