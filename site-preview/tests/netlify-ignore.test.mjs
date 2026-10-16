import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { needsBuild } from "../scripts/netlify-ignore.mjs";

const script = fileURLToPath(new URL("../scripts/netlify-ignore.mjs", import.meta.url));
const run = (env) => { try { execFileSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, stdio: "pipe" }); return 0; } catch (error) { return error.status; } };

test("tooling, tests, catalog data and docs skip the deploy; anything served builds", () => {
  // The files PR 113 changed: tooling and data only, so no production deploy.
  assert.equal(needsBuild([".agents/skills/aha-catalog/SKILL.md", "AGENTS.md", "site-preview/catalog/ledger.json", "site-preview/tests/catalog-engine.test.mjs", "site-preview/tools/catalog/cli.mjs", "site-preview/tools/images/bases/SS4500-front.webp"]), false);
  for (const file of ["site-preview/src/pages/shop/[product].astro", "site-preview/server/fulfillment/catalog.mjs", "site-preview/netlify/functions/square-webhook.mjs", "site-preview/public/images/a.webp", "site-preview/package.json", "netlify.toml", "site-preview/netlify.toml", "netlify/database/migrations/x/migration.sql", "site-preview/scripts/finalize.mjs", "site-preview/src/data/products.json"]) {
    assert.equal(needsBuild(["AGENTS.md", file]), true, file);
  }
});

test("the ignore command builds whenever it can't prove a skip", () => {
  assert.equal(run({}), 1, "no refs");
  assert.equal(run({ CACHED_COMMIT_REF: "abc", COMMIT_REF: "abc" }), 1, "rebuild of the same commit");
  assert.equal(run({ CACHED_COMMIT_REF: "0000000000000000000000000000000000000000", COMMIT_REF: "1111111111111111111111111111111111111111" }), 1, "unknown commits");
});

test("both Netlify configurations use the same ignore command", async () => {
  const nested = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  const root = await readFile(new URL("../../netlify.toml", import.meta.url), "utf8");
  for (const file of [nested, root]) assert.match(file, /\n  ignore = "node scripts\/netlify-ignore\.mjs"\n/);
});
