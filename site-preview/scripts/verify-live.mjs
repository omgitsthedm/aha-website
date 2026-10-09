import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
process.env.AHA_PRODUCTION_BUILD = "approved";
const { routes, privateRoutes, indexableRoutes } =
  await import("../src/data/site.ts");

const origin = "https://afterhoursagenda.com";
const get = async (path) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, path);
  return response;
};
const release = await (await get("/release.json")).json();
assert.equal(release.project, "After Hours Agenda");
assert.equal(release.mode, "production");
assert.equal(release.siteId, "275b4115-16bf-42fb-9b36-6bce9bb93608");
assert.match(release.sourceCommit, /^[0-9a-f]{40}$/);
assert.match(release.artifactDigest, /^[0-9a-f]{64}$/);
if (process.env.EXPECTED_COMMIT)
  assert.equal(release.sourceCommit, process.env.EXPECTED_COMMIT);

for (const path of routes) {
  const response = await get(path);
  assert.ok(
    !(response.headers.get("x-robots-tag") || "").includes("noindex"),
    path,
  );
  assert.ok(
    (response.headers.get("content-security-policy") || "").includes(
      "object-src 'none'",
    ),
    path,
  );
  const html = await response.text();
  assert.ok(html.includes(`href="${origin}${path}"`), path);
  assert.ok(
    html.includes(
      privateRoutes.includes(path)
        ? 'name="robots" content="noindex, noarchive"'
        : 'name="robots" content="index, follow, max-image-preview:large"',
    ),
    path,
  );
  assert.ok(!html.includes("Website preview"), path);
}
for (const file of [
  "googleb80e08d782fcdd45.html",
  "google9dd9990931be8b22.html",
  "BingSiteAuth.xml",
])
  assert.equal(
    await (await get(`/${file}`)).text(),
    await readFile(new URL(`../public/${file}`, import.meta.url), "utf8"),
  );
const sitemap = await (await get("/sitemap.xml")).text();
for (const path of indexableRoutes)
  assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
console.log(
  JSON.stringify(
    { verified: true, routes: routes.length, ownershipFiles: 3, release },
    null,
    2,
  ),
);
