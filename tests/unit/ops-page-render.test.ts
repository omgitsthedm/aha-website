// Renders the real /ops server component and asserts on the HTML an operator
// actually receives. The source-level guard in ops-operator-surface.test.ts
// proves the actions are written down; this proves they survive the conditions
// that decide whether each one is drawn at all.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createOpsSessionToken } from "@/lib/ops/auth";
import { fulfillments, notificationOutbox, orders, webhookEvents } from "@/db/schema";

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirected to ${to}`); } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown> & { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));
vi.mock("next/script", () => ({
  default: (props: Record<string, unknown>) => createElement("script", props),
}));
vi.mock("@/lib/commerce/reviews", () => ({ listReviewsByStatus: async () => [] }));

const HELD_ERROR = "APLIIQ order submission is disabled by server-side production gates.";
const SWEEP_REASON = "APLIIQ is awaiting artwork";
const at = new Date("2026-08-17T12:00:00.000Z");

const paidOrder = {
  id: 77, externalOrderNumber: "AHA-1077", createdAt: at, paymentStatus: "paid",
  fulfillmentStatus: "manual_review", totalAmount: 12000, currency: "USD",
};
const unpaidOrder = {
  id: 78, externalOrderNumber: "AHA-1078", createdAt: at, paymentStatus: "pending",
  fulfillmentStatus: "not_started", totalAmount: 4500, currency: "USD",
};
// The held claim: no provider order id, no request id — retry walks past it.
const heldClaim = {
  id: 501, orderId: 77, fulfillmentProvider: "apliiq", status: "manual_review",
  providerOrderId: null, providerRequestId: null, printfulOrderId: null,
  lastError: HELD_ERROR, attentionReason: SWEEP_REASON,
};
// A claim APLIIQ already holds: release must NOT be offered on it.
const livingClaim = {
  id: 502, orderId: 78, fulfillmentProvider: "apliiq", status: "draft_created",
  providerOrderId: "550123", providerRequestId: "aha-apliiq-78", printfulOrderId: null,
  lastError: null, attentionReason: null,
};
const attentionRows = [
  {
    id: 501, orderId: 77, orderNumber: "AHA-1077", fulfillmentProvider: "apliiq",
    status: "manual_review", providerOrderId: null, providerRequestId: null,
    providerReference: "AHA-1077", printfulOrderId: null, lastError: HELD_ERROR,
    attentionAt: at, attentionReason: SWEEP_REASON, updatedAt: at,
  },
  {
    id: 999, orderId: null, orderNumber: null, fulfillmentProvider: "apliiq",
    status: "manual_review", providerOrderId: null, providerRequestId: null,
    providerReference: "orphan-ref", printfulOrderId: null, lastError: "Unattributable record",
    attentionAt: at, attentionReason: "APLIIQ returned no attributable order record", updatedAt: at,
  },
];

// One chain per db() call. `.limit()` ends the four paged queries; the fifth
// (order fulfillments) is awaited straight off `.where()`, so the chain is a
// thenable too and the table decides which fixture comes back.
function chain() {
  let table: unknown;
  const rows = (limited: boolean): unknown[] => {
    if (table === orders) return [paidOrder, unpaidOrder];
    if (table === webhookEvents) return [];
    if (table === notificationOutbox) return [];
    if (table === fulfillments) return limited ? attentionRows : [heldClaim, livingClaim];
    return [];
  };
  const self: Record<string, unknown> = {
    select: () => self,
    from: (value: unknown) => { table = value; return self; },
    leftJoin: () => self,
    where: () => self,
    orderBy: () => self,
    limit: () => Promise.resolve(rows(true)),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(rows(false)).then(resolve, reject),
  };
  return self;
}

vi.mock("@/lib/db/client", () => ({ isDbConfigured: () => true, db: () => chain() }));

const { default: OpsPage } = await import("@/app/ops/page");

async function html(): Promise<string> {
  vi.stubEnv("AHA_OPS_SESSION_SECRET", "test-ops-secret");
  state.cookie = createOpsSessionToken();
  const markup = renderToStaticMarkup(await OpsPage());
  vi.unstubAllEnvs();
  state.cookie = undefined;
  return markup;
}

describe("/ops rendered operator surface", () => {
  it("renders a Release APLIIQ hold form for the held order in both tables", async () => {
    const markup = await html();
    expect(markup).toContain("Release APLIIQ hold");
    expect([...markup.matchAll(/action="\/api\/ops\/orders\/77\/apliiq-resubmit"/g)]).toHaveLength(2);
  });

  it("never offers a release on a claim APLIIQ already holds", async () => {
    const markup = await html();
    expect(markup).not.toContain('action="/api/ops/orders/78/apliiq-resubmit"');
  });

  it("renders an acknowledge form for the flagged order", async () => {
    const markup = await html();
    expect(markup).toContain('action="/api/ops/orders/77/acknowledge-attention"');
    expect(markup).toContain(">Acknowledge<");
  });

  it("offers no acknowledge on an attention row with no order to acknowledge", async () => {
    const markup = await html();
    expect(markup).toContain("Unlinked row");
    expect(markup).not.toMatch(/action="\/api\/ops\/orders\/(null|NaN|undefined)\/acknowledge-attention"/);
  });

  it("keeps the retry action live on the paid order and disabled on the unpaid one", async () => {
    const markup = await html();
    // Adjacency matters: the button has to be THIS form's button.
    expect(markup).toContain('action="/api/ops/orders/77/retry" method="post"><button class=');
    expect(markup).toContain('action="/api/ops/orders/78/retry" method="post"><button disabled=""');
  });

  it("marks every enhanced action so the page script can find it", async () => {
    const markup = await html();
    expect([...markup.matchAll(/data-ops-action="Retry fulfillment"/g)]).toHaveLength(2);
    expect([...markup.matchAll(/data-ops-action="Release APLIIQ hold"/g)]).toHaveLength(2);
    expect([...markup.matchAll(/data-ops-action="Acknowledge attention"/g)]).toHaveLength(1);
  });

  // audit HIGH 7: these were counted in SQL and never drawn.
  it("puts the provider identifiers and both reasons on the page", async () => {
    const markup = await html();
    expect(markup).toContain("apliiq:550123");
    expect(markup).toContain("aha-apliiq-78");
    expect(markup).toContain(HELD_ERROR);
    expect(markup).toContain(`attention: ${SWEEP_REASON}`);
    // Both facts on the same row, not one hiding the other.
    expect([...markup.matchAll(new RegExp(HELD_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].length)
      .toBeGreaterThanOrEqual(2);
  });

  it("ships the status region and the enhancement script the actions report into", async () => {
    const markup = await html();
    for (const id of ["ops-action-status", "ops-action-status-title", "ops-action-status-detail", "ops-action-status-evidence"]) {
      expect(markup).toContain(`id="${id}"`);
    }
    expect(markup).toContain("form[data-ops-action]");
  });
});
