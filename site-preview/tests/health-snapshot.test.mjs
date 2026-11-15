import assert from "node:assert/strict";
import test from "node:test";
import { publishSnapshot, readSnapshot } from "../server/operations/health-snapshot.mjs";

const now = Date.parse("2026-11-15T10:00:00Z");
const healthy = { ok: true, checkedAt: new Date(now).toISOString(), checks: { monitor_configured: true }, problems: [] };
function memoryStore() {
  let data = null, version = 0;
  return {
    get: async () => data,
    getWithMetadata: async () => data && { data, etag: String(version) },
    setJSON: async (_key, payload, condition) => {
      if (data ? condition.onlyIfMatch !== String(version) : !condition.onlyIfNew) return { modified: false };
      data = payload;
      version++;
      return { modified: true };
    },
  };
}

test("independent reads reuse the aggregate result, including a receipt incident and recovery", async () => {
  const store = memoryStore();
  assert.equal((await readSnapshot(store, now)).ok, false);
  await publishSnapshot(store, { ...healthy, emailed: false });
  assert.deepEqual(await readSnapshot(store, now), healthy);
  assert.deepEqual(await readSnapshot(store, now + 4 * 60_000), healthy);
  const incident = { ...healthy, ok: false, problems: [{ code: "receipt_missing", count: 1 }], checkedAt: new Date(now + 1).toISOString() };
  await publishSnapshot(store, incident);
  await publishSnapshot(store, healthy);
  assert.deepEqual(await readSnapshot(store, now + 2), incident);
  const recovered = { ...healthy, checkedAt: new Date(now + 3).toISOString() };
  await publishSnapshot(store, recovered);
  assert.deepEqual(await readSnapshot(store, now + 4), recovered);
});

test("expired, future-dated and malformed observations cannot report healthy", async () => {
  const store = memoryStore();
  await publishSnapshot(store, healthy);
  assert.equal((await readSnapshot(store, now + 20 * 60_000 + 1)).problems[0].code, "commerce_monitor_stale");
  assert.equal((await readSnapshot(store, now - 1)).ok, false);
  for (const invalid of [{}, { ...healthy, checkedAt: "invalid" }, { ...healthy, ok: false }])
    assert.equal((await readSnapshot({ get: async () => invalid }, now)).ok, false);
});

test("write conflicts are retried and persistent storage failures remain visible", async () => {
  const store = memoryStore();
  const write = store.setJSON;
  let calls = 0;
  store.setJSON = (...args) => ++calls === 1 ? { modified: false } : write(...args);
  await publishSnapshot(store, healthy);
  assert.equal(calls, 2);
  store.setJSON = () => ({ modified: false });
  await assert.rejects(publishSnapshot(store, healthy), /write_conflict/);
});

test("authenticated health endpoint reads only the snapshot and fails closed on missing or stale data", async (t) => {
  const { default: health } = await import("../netlify/functions/commerce-health.mjs");
  const { AHA_SITE_ID } = await import("../server/fulfillment/runtime.mjs");
  const context = { site: { id: AHA_SITE_ID }, deploy: { context: "production" } };
  const blobHost = "https://snapshot.invalid";
  // Synthetic runtime configuration; every HTTP request is intercepted locally.
  const blobContext = { siteID: AHA_SITE_ID, token: "fixture", edgeURL: blobHost, uncachedEdgeURL: blobHost };
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).origin, blobHost);
    return reply();
  });
  const fixtureEnv = new Map([
    ["NETLIFY_BLOBS_CONTEXT", Buffer.from(JSON.stringify(blobContext)).toString("base64")],
    ["AHA_COMMERCE_MONITOR_TOKEN", "local-test-token"],
  ]);
  globalThis.Netlify = { env: fixtureEnv };
  t.after(() => { delete globalThis.Netlify; });
  let reply = () => Response.json({ ...healthy, checkedAt: new Date().toISOString() });
  const request = new Request("https://afterhoursagenda.com/api/commerce/health", {
    headers: { authorization: "Bearer local-test-token" },
  });
  assert.equal((await health(request, context)).status, 200);
  for (const [response, code] of [
    [() => new Response(null, { status: 404 }), "commerce_check_unavailable"],
    [() => Response.json({ ...healthy, checkedAt: new Date(Date.now() - 21 * 60_000).toISOString() }), "commerce_monitor_stale"],
    [() => Response.json({ ok: false, checkedAt: new Date().toISOString(), problems: [{ code: "receipt_missing", count: 1 }] }), "receipt_missing"],
    [() => new Response("unreadable"), "commerce_check_unavailable"],
  ]) {
    reply = response;
    const result = await health(request, context);
    assert.equal(result.status, 503);
    assert.equal((await result.json()).problems[0].code, code);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 5);
});
