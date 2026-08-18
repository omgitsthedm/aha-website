// The two findings that closed on the same defect: a held APLIIQ order was
// releasable only by hand-crafting a POST, and the attention flag was clearable
// only in SQL. Both were "the endpoint exists but nothing links to it", so the
// regression guard has to be about the LINK, not the endpoint.
//
// This reads the ops page as source and proves three things a route test cannot:
// the actions are rendered, every action posts at a route that actually exists
// on disk, and the provider identifiers an APLIIQ support claim needs are on the
// page rather than in SQL (audit HIGH 7).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const page = await readFile(new URL("../../app/ops/page.tsx", import.meta.url), "utf8");

/** Every `action=` on the page, template literals included. */
function formActions(source: string): string[] {
  const found = new Set<string>();
  // The lookbehind keeps `data-ops-action="..."` labels out of the endpoint set.
  for (const match of source.matchAll(/(?<![-\w])action=(?:\{`([^`]+)`\}|"([^"]+)")/g)) {
    found.add((match[1] ?? match[2]) as string);
  }
  return [...found];
}

/** `/api/ops/orders/${order.id}/retry` -> `app/api/ops/orders/[id]/retry/route.ts` */
function routeFileFor(action: string): string {
  return `app/${action.replace(/^\//, "").replace(/\$\{[^}]+\}/g, "[id]")}/route.ts`;
}

/** The label the operator sees, which is also the key the page script keys on. */
function opsActionLabels(source: string): string[] {
  return [...source.matchAll(/data-ops-action="([^"]+)"/g)].map((match) => match[1]);
}

describe("ops operator surface", () => {
  it("offers a Release APLIIQ hold action that posts at the break-glass endpoint", () => {
    expect(opsActionLabels(page)).toContain("Release APLIIQ hold");
    const release = [...page.matchAll(/data-ops-action="Release APLIIQ hold" action=\{`([^`]+)`\}/g)].map((m) => m[1]);
    expect(release.length).toBeGreaterThan(0);
    for (const action of release) expect(action).toMatch(/\/api\/ops\/orders\/\$\{[^}]+\}\/apliiq-resubmit$/);
  });

  it("offers an Acknowledge attention action that posts at the acknowledge endpoint", () => {
    expect(opsActionLabels(page)).toContain("Acknowledge attention");
    const ack = [...page.matchAll(/data-ops-action="Acknowledge attention" action=\{`([^`]+)`\}/g)].map((m) => m[1]);
    expect(ack.length).toBeGreaterThan(0);
    for (const action of ack) expect(action).toMatch(/\/api\/ops\/orders\/\$\{[^}]+\}\/acknowledge-attention$/);
  });

  it("still offers the ordinary retry alongside them", () => {
    expect(opsActionLabels(page)).toContain("Retry fulfillment");
  });

  // "Nothing links to it" has an exact inverse: every link resolves.
  it("posts every action at a route handler that exists", () => {
    const actions = formActions(page);
    expect(actions).toEqual(expect.arrayContaining([
      "/api/ops/orders/${order.id}/retry",
      "/api/ops/orders/${order.id}/apliiq-resubmit",
      "/api/ops/orders/${row.orderId}/acknowledge-attention",
    ]));
    // Every one of them, not just the three above.
    for (const action of actions) expect(action).toMatch(/^\/api\//);
    const missing = actions.filter((action) => !existsSync(`${repoRoot}${routeFileFor(action)}`));
    expect(missing).toEqual([]);
  });

  it("renders the provider identifiers every APLIIQ support claim needs", () => {
    for (const field of ["providerOrderId", "providerRequestId", "lastError", "attentionReason"]) {
      expect(page).toContain(`row.${field}`);
    }
  });

  // lastError || attentionReason hid the sweep's reason behind a submission
  // error whenever a row carried both. They are different facts.
  it("never collapses lastError and attentionReason into one slot", () => {
    // The defect shape: one slot whose value falls back from one fact to the
    // other, so a row carrying both showed only the submission error.
    expect(page).not.toMatch(/>\{row\.lastError \|\| row\.attentionReason\}</);
    // Both tables render both facts in their own element.
    expect([...page.matchAll(/\{row\.lastError \? <span[^>]*>\{row\.lastError\}<\/span> : null\}/g)]).toHaveLength(2);
    expect([...page.matchAll(/\{row\.attentionReason \? <span[^>]*>attention: \{row\.attentionReason\}<\/span> : null\}/g)]).toHaveLength(2);
  });

  it("wires the progressive-enhancement script to element ids that exist on the page", () => {
    const referenced = [...page.matchAll(/getElementById\('([^']+)'\)/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(page).toContain(`id="${id}"`);
    // It enhances the marked forms only; the provider-check and sign-out forms
    // must keep submitting natively.
    expect(page).toContain("form[data-ops-action]");
  });

  it("keeps a no-script path: every enhanced action is a real form post", () => {
    for (const match of page.matchAll(/<form data-ops-action="[^"]+"[^>]*>/g)) {
      expect(match[0]).toContain('method="post"');
    }
  });
});
