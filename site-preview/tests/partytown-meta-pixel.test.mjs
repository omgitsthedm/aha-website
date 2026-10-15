import assert from "node:assert/strict";
import test from "node:test";
import handler from "../netlify/functions/partytown-meta-pixel.mjs";

const context = { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "production" } };
const base = "https://afterhoursagenda.com";

test("Partytown Meta proxy only fetches the two fixed Meta scripts", async (t) => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response("/* pixel */", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const path of ["/api/partytown/meta-pixel/bootstrap", "/api/partytown/meta-pixel/config"]) {
    const response = await handler(new Request(`${base}${path}`), context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/javascript; charset=utf-8");
    assert.equal(await response.text(), "/* pixel */");
  }
  assert.deepEqual(fetched, [
    "https://connect.facebook.net/en_US/fbevents.js",
    "https://connect.facebook.net/signals/config/1815233516346046",
  ]);
});

test("Partytown Meta proxy serves a cacheable, nosniff HEAD response without exposing a body", async (t) => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url, init) => {
    fetched.push([String(url), init]);
    return new Response("must not be returned for HEAD", { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handler(new Request(`${base}/api/partytown/meta-pixel/bootstrap`, { method: "HEAD" }), context);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("cache-control"), "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  assert.equal(response.headers.get("content-type"), "application/javascript; charset=utf-8");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(fetched.map(([url]) => url), ["https://connect.facebook.net/en_US/fbevents.js"]);
  assert.equal(fetched[0][1].headers.Accept, "application/javascript");
});

test("Partytown Meta proxy returns a headerless 502 for failed upstream responses", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? new Response("upstream failure", { status: 503 }) : Promise.reject(new Error("network unavailable"));
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const path of ["/api/partytown/meta-pixel/bootstrap", "/api/partytown/meta-pixel/config"]) {
    const response = await handler(new Request(`${base}${path}`), context);
    assert.equal(response.status, 502);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("cache-control"), null);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("Partytown Meta proxy turns its bounded upstream abort into a 502", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let observedSignal;
  globalThis.setTimeout = (callback) => {
    callback();
    return Symbol("timer");
  };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (_url, init) => {
    observedSignal = init.signal;
    assert.equal(init.signal.aborted, true);
    throw new DOMException("The operation was aborted", "AbortError");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  const response = await handler(new Request(`${base}/api/partytown/meta-pixel/bootstrap`), context);
  assert.ok(observedSignal);
  assert.equal(response.status, 502);
  assert.equal(await response.text(), "");
});

test("Partytown Meta proxy rejects previews, mutations, and arbitrary paths before fetch", async (t) => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response("unexpected"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const [url, init, runtime] of [
    [`${base}/api/partytown/meta-pixel/unknown`, {}, context],
    [`${base}/api/partytown/meta-pixel/bootstrap`, { method: "POST" }, context],
    [`https://preview.afterhoursagenda.com/api/partytown/meta-pixel/bootstrap`, {}, { ...context, deploy: { context: "deploy-preview" } }],
  ]) {
    const response = await handler(new Request(url, init), runtime);
    assert.equal(response.status, 404);
  }
  assert.equal(requests, 0);
});
