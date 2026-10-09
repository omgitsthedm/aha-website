import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { routes } from "../src/data/site.ts";
const base = "https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app";
const dist = new URL("../dist/", import.meta.url);
const local = JSON.parse(await readFile(new URL("release.json", dist), "utf8"));
const remote = await (
  await fetch(base + "/release.json", { cache: "no-store" })
).json();
assert.deepEqual(remote, local);
assert.equal(remote.mode, "preview");
assert.equal(remote.siteId, "275b4115-16bf-42fb-9b36-6bce9bb93608");
let files = 0;
async function walk(dir, prefix = "") {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + item.name;
    if (item.isDirectory()) {
      await walk(new URL(item.name + "/", dir), path + "/");
      continue;
    }
    if (item.name === "_headers") continue;
    const response = await fetch(base + "/" + path, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, path);
    const expected = await readFile(new URL(item.name, dir));
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex"),
      createHash("sha256").update(expected).digest("hex"),
      path,
    );
    files++;
  }
}
await walk(dist);
for (const path of routes) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  assert.match(
    await response.text(),
    /name="robots" content="noindex, noarchive"/,
  );
}
const proofs = [];
for (const [path, input, status] of [
  [
    "order-status",
    {
      orderNumber: "AHA-DEMO-1001",
      email: "review@example.com",
      postalCode: "10001",
    },
    200,
  ],
  ["unsubscribe", { email: "review@example.com" }, 200],
  [
    "metrics",
    { event: "page_view", path: "/", device: "desktop", consent: true },
    202,
  ],
  [
    "create-payment",
    {
      sourceId: "LOCAL-ONLY",
      lines: [{ squareVariationId: "FORGED", quantity: 1 }],
      quotedTotal: 1,
    },
    409,
  ],
  ["webhooks/square", {}, 503],
]) {
  const response = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  assert.equal(response.status, status, path);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  if (["order-status", "unsubscribe", "metrics"].includes(path))
    assert.equal(payload.preview, true);
  proofs.push({ path, status: response.status, payload });
}
const capability = await (await fetch(base + "/api/commerce")).json();
assert.equal(capability.ready, false);
const production = await (
  await fetch("https://afterhoursagenda.com/release.json", {
    cache: "no-store",
  })
).json();
assert.equal(
  production.sourceCommit,
  "7a23f9846a337de2ac85bb34014d5b3f983ca71c",
);
const proof = {
  verified: true,
  files,
  routes: routes.length,
  release: remote,
  services: proofs,
  productionUnchanged: production,
};
await writeFile(
  new URL(
    "../../../evidence/customer-hosted-verification.json",
    import.meta.url,
  ),
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof, null, 2));
