import client from "../client.config.json" with { type: "json" };
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { moved, routes } from "../src/data/site.ts";

const origin = client.site.origin;
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
assert.equal(release.siteId, client.site.netlifySiteId);
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
      'name="robots" content="index, follow, max-image-preview:large"',
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
for (const path of routes)
  assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
for (const [from, to] of moved)
  for (const path of [from.replace(/\/$/, ""), from]) {
    const response = await fetch(`${origin}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 301, path);
    assert.equal(
      new URL(response.headers.get("location") || "", origin).href,
      new URL(to, origin).href,
      path,
    );
  }
// The Meta catalog reads its feed at the extensionless address (a _redirects rewrite).
for (const path of ["/feeds/meta", "/feeds/meta/"]) {
  const response = await get(path);
  assert.match(response.headers.get("content-type") || "", /xml/, path);
  assert.match(await response.text(), /<rss[\s>]/, path);
}
console.log(
  JSON.stringify(
    { verified: true, routes: routes.length, redirects: moved.length * 2, feedRewrites: 2, ownershipFiles: 3, release },
    null,
    2,
  ),
);
