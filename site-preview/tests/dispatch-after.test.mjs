import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchAfterResponse } from "../server/notifications/dispatch-after.mjs";

const notificationsWith = (dispatch) => ({ service: { dispatch } });

test("webhook email dispatch runs after the response when waitUntil exists", async () => {
  const calls = [];
  let deferred;
  const context = { waitUntil: (promise) => { deferred = promise; } };
  const result = await dispatchAfterResponse(notificationsWith(async (limit) => { calls.push(limit); return { sent: 1 }; }), context);
  assert.equal(result, null);
  await deferred;
  assert.deepEqual(calls, [2]);
});

test("webhook email dispatch is awaited inline without waitUntil", async () => {
  const result = await dispatchAfterResponse(notificationsWith(async () => ({ sent: 1 })), {});
  assert.deepEqual(result, { sent: 1 });
});

test("a failed email dispatch never fails the webhook", async () => {
  const thrown = await dispatchAfterResponse(notificationsWith(async () => { throw new Error("resend down"); }), {});
  assert.equal(thrown, null);
  const syncThrow = await dispatchAfterResponse(notificationsWith(() => { throw new Error("boom"); }), {});
  assert.equal(syncThrow, null);
});

test("background jobs run hourly so the database can sleep between orders", () => {
  for (const name of ["fulfillment-reconcile", "notification-dispatch"]) {
    const source = readFileSync(new URL(`../netlify/functions/${name}.mjs`, import.meta.url), "utf8");
    assert.match(source, /schedule: "0 \* \* \* \*"/, `${name} must run hourly`);
  }
  for (const name of ["square-webhook", "apliiq-fulfillment-webhook"]) {
    const source = readFileSync(new URL(`../netlify/functions/${name}.mjs`, import.meta.url), "utf8");
    assert.match(source, /dispatchAfterResponse\(runtime\.notifications, context\)/, `${name} must send emails immediately`);
  }
});
