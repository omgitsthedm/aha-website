import { routes } from "../src/data/site.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const root = new URL("../dist/", import.meta.url);
const production = process.env.AHA_PRODUCTION_BUILD === "approved";
const origin = production
  ? "https://afterhoursagenda.com"
  : "https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app";
test("every route has unique metadata, entity data and correct indexing mode", async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const route of routes) {
    const html = await readFile(
      new URL(`${route.slice(1)}index.html`, root),
      "utf8",
    );
    assert.equal((html.match(/<h1\b/g) || []).length, 1, route);
    if (production) {
      assert.match(
        html,
        /name="robots" content="index, follow, max-image-preview:large"/,
      );
      assert.ok(!html.includes("Website preview"), route);
      assert.ok(!html.includes("noindex"), route);
    } else {
      assert.match(html, /name="robots" content="noindex, noarchive"/);
      assert.ok(html.includes("Website preview"), route);
    }
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /After Hours Agenda/);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    const description = html.match(/name="description" content="([^"]+)"/)?.[1];
    assert.ok(title && !titles.has(title), route);
    titles.add(title);
    assert.ok(description && !descriptions.has(description), route);
    descriptions.add(description);
    assert.ok(html.includes(`href="${origin}${route}"`), route);
    for (const match of html.matchAll(
      /(?:src|href)="(\/(?:_astro|images|fonts|brand)\/[^"?#]+)"/g,
    ))
      await stat(new URL(match[1].slice(1), root));
    assert.ok(
      !/googletagmanager|google-analytics|squarecdn|data-netlify|Little Fight NYC|hello@littlefightnyc|Small crew|Heavy pull/.test(
        html,
      ),
      route,
    );
  }
});
test("all inline script content is covered by CSP hashes", async () => {
  const { createHash } = await import("node:crypto");
  const headers = await readFile(new URL("_headers", root), "utf8");
  for (const route of [...routes, "/404.html"]) {
    const file = route.endsWith(".html")
      ? route.slice(1)
      : `${route.slice(1)}index.html`;
    const html = await readFile(new URL(file, root), "utf8");
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
      if (match[1])
        assert.ok(
          headers.includes(
            createHash("sha256").update(match[1]).digest("base64"),
          ),
        );
  }
  assert.ok(!headers.includes("unsafe-inline"));
  assert.ok(!headers.includes("unsafe-eval"));
  assert.match(headers, /connect-src 'self'/);
  assert.match(headers, /form-action 'none'/);
  assert.equal(headers.includes("X-Robots-Tag: noindex"), !production);
});
test("sitemap, crawler policy and summary match the release mode", async () => {
  const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
  assert.equal((sitemap.match(/<url>/g) || []).length, routes.length);
  for (const path of routes)
    assert.ok(sitemap.includes(`${origin}${path}</loc>`));
  assert.match(
    await readFile(new URL("llms.txt", root), "utf8"),
    production
      ? /Official editorial website/
      : /review preview, not a production replacement/,
  );
  const robots = await readFile(new URL("robots.txt", root), "utf8");
  assert.ok(
    robots.includes(
      `User-agent: Google-Extended\n${production ? "Allow" : "Disallow"}: /`,
    ),
  );
  assert.ok(robots.includes("User-agent: GPTBot\nDisallow: /"));
  assert.ok(robots.includes("User-agent: ClaudeBot\nDisallow: /"));
});
test("existing Google and Bing ownership files remain byte-identical", async () => {
  for (const file of [
    "googleb80e08d782fcdd45.html",
    "google9dd9990931be8b22.html",
    "BingSiteAuth.xml",
  ]) {
    assert.deepEqual(
      await readFile(new URL(file, root)),
      await readFile(new URL(`../../public/${file}`, import.meta.url)),
    );
  }
});
test("no server bundle, sensitive files or source maps enter the artifact", async () => {
  let jsBytes = 0;
  const walk = async (dir) => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      assert.ok(
        !/^(\.env|node_modules|\.netlify|\.git|api|functions|database)/.test(
          item.name,
        ),
        item.name,
      );
      assert.ok(!/\.(map|ts|tsx|sql|md)$/.test(item.name), item.name);
      if (item.isDirectory()) await walk(new URL(`${item.name}/`, dir));
      else if (item.name.endsWith(".js"))
        jsBytes += (await stat(new URL(item.name, dir))).size;
    }
  };
  await walk(root);
  assert.ok(jsBytes < 12000, `Client JS must stay under 12 KB; got ${jsBytes}`);
});
test("production context is refused by default", () => {
  const result = spawnSync(process.execPath, ["scripts/guard-build.mjs"], {
    env: { ...process.env, CONTEXT: "production", AHA_PRODUCTION_BUILD: "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr.toString(), /Production build refused/);
});

test("release digest covers every published file except its own receipt", async () => {
  const { createHash } = await import("node:crypto");
  const files = [];
  const walk = async (dir, prefix = "") => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = prefix + item.name;
      if (item.isDirectory())
        await walk(new URL(`${item.name}/`, dir), `${path}/`);
      else if (path !== "release.json") {
        const buffer = await readFile(new URL(item.name, dir));
        files.push({
          path,
          bytes: buffer.length,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        });
      }
    }
  };
  await walk(root);
  const release = JSON.parse(
    await readFile(new URL("release.json", root), "utf8"),
  );
  assert.equal(release.mode, production ? "production" : "preview");
  assert.equal(release.siteId, "275b4115-16bf-42fb-9b36-6bce9bb93608");
  assert.equal(
    release.artifactDigest,
    createHash("sha256")
      .update(
        JSON.stringify(files.sort((a, b) => a.path.localeCompare(b.path))),
      )
      .digest("hex"),
  );
});
