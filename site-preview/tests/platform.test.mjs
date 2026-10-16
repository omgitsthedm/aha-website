import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import config from "../client.config.json" with { type: "json" };
import { clientConfigProblems, CLIENT, COMMERCE_TARGETS, NETLIFY_SITE_ID, PRINT_PROVIDERS, SITE_HOST, SITE_ORIGIN, SQUARE_VERSION } from "../server/platform/client.mjs";
import { createSquareGateway } from "../server/fulfillment/square.mjs";

const app = new URL("../", import.meta.url);

test("this store's client config is valid and drives the platform constants", () => {
  assert.deepEqual(clientConfigProblems(config), []);
  assert.equal(SITE_ORIGIN, "https://afterhoursagenda.com");
  assert.equal(SITE_HOST, "afterhoursagenda.com");
  assert.equal(NETLIFY_SITE_ID, "275b4115-16bf-42fb-9b36-6bce9bb93608");
  assert.equal(SQUARE_VERSION, "2026-09-16");
  assert.equal(CLIENT.print.privateLabel.code, "SB-3-161622");
});

test("a bad client config is rejected with plain reasons", () => {
  const bad = structuredClone(config);
  bad.site.origin = "http://example.com/shop";
  bad.site.netlifySiteId = "afterhoursagenda";
  bad.print.provider = "printful";
  bad.commerce.provider = "shopify";
  bad.analytics.ga4 = "UA-123";
  bad.brand.accent = "pink";
  bad.client.apiToken = "sk_live_abc";
  const problems = clientConfigProblems(bad).join("\n");
  for (const pattern of [/site\.origin must be an https origin/, /exact Netlify site ID/, /print\.provider printful has no connector yet/, /commerce\.provider shopify has no connector yet/, /analytics\.ga4/, /brand\.accent/, /must not contain secrets/]) assert.match(problems, pattern);
  const script = fileURLToPath(new URL("../tools/platform/check.mjs", import.meta.url));
  assert.throws(() => execFileSync(process.execPath, [script, "/nonexistent.json"], { stdio: "pipe" }));
});

test("connectors declare capability flags, and only Square and Apliiq are implemented", () => {
  assert.deepEqual(Object.entries(PRINT_PROVIDERS).filter(([, provider]) => provider.implemented).map(([key]) => key), ["apliiq"]);
  assert.deepEqual(Object.entries(COMMERCE_TARGETS).filter(([, target]) => target.implemented).map(([key]) => key), ["square"]);
  assert.equal(PRINT_PROVIDERS.apliiq.capabilities.cancelApi, false, "Apliiq can't cancel by API; the daily check tells the owner instead");
  assert.equal(PRINT_PROVIDERS.apliiq.capabilities.idempotencyKeys, false, "Apliiq creates stay intent-guarded");
});

test("store identity lives only in client.config.json", async () => {
  const offenders = [];
  async function scan(directory) {
    for (const entry of await readdir(new URL(directory, app), { withFileTypes: true })) {
      const relative = `${directory}${entry.name}`;
      if (entry.isDirectory()) { if (!["logs", "out", "bases", "node_modules"].includes(entry.name)) await scan(`${relative}/`); continue; }
      if (!/\.(mjs|ts)$/.test(entry.name) || relative === "server/fulfillment/catalog.mjs") continue;
      const source = await readFile(new URL(relative, app), "utf8");
      if (source.includes(NETLIFY_SITE_ID) || source.includes('"https://afterhoursagenda.com"') || source.includes("SB-3-161622") || source.includes('"2026-09-16"')) offenders.push(relative);
    }
  }
  for (const directory of ["server/", "netlify/functions/", "tools/", "scripts/", "src/"]) await scan(directory);
  assert.deepEqual(offenders, []);
  const astroConfig = await readFile(new URL("astro.config.mjs", app), "utf8");
  assert.ok(astroConfig.includes(`/signals/config/${config.analytics.metaPixel}`), "the serialized Partytown resolver must use the configured Meta dataset");
});

test("Square catalog reads for thousands of variations are split into 1,000-id requests", async () => {
  const bodies = [];
  const square = createSquareGateway({ accessToken: "test", fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); bodies.push(body.object_ids.length); return new Response(JSON.stringify({ objects: body.object_ids.map((id) => ({ id })) })); } });
  const ids = Array.from({ length: 2_500 }, (_, index) => `VAR${index}`);
  const objects = await square.batchRetrieve(ids);
  assert.deepEqual(bodies, [1000, 1000, 500]);
  assert.equal(objects.length, 2_500);
});
