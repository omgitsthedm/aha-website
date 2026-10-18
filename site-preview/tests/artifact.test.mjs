import { answers, moved, routes } from "../src/data/site.ts";
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
      !/squarecdn|data-netlify|Little Fight NYC|hello@littlefightnyc|Small crew|Heavy pull/.test(
        html,
      ),
      route,
    );
    assert.ok(!/<script[^>]+src="https:\/\/(?:www\.googletagmanager|connect\.facebook)/.test(html),'Tracking scripts must load dynamically so saved choices and Global Privacy Control govern them');
    assert.ok(html.includes(`data-tracking-enabled="${production}"`),route);
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
  const scriptPolicy = headers.match(/script-src ([^;]+)/)?.[1] ?? "";
  assert.ok(!scriptPolicy.includes("unsafe-inline"));
  assert.match(headers, /style-src 'self' 'unsafe-inline'/, "Square requires its dynamic UI styles");
  assert.match(headers, /payment=\(self/, "Wallet payment requests must be permitted");
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
      ? /Official clothing storefront/
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
test("the manifesto lives in The story and its old address redirects there", async () => {
  const about = await readFile(new URL("about/index.html", root), "utf8");
  assert.match(about, /id="manifesto"/);
  for (const tenet of ["Work hard. Love hard.", "Celebrate.", "Be kind.", "Find your people."])
    assert.ok(about.includes(`<h3>${tenet}</h3>`), tenet);
  await assert.rejects(stat(new URL("manifesto/index.html", root)));
  const redirects = await readFile(new URL("_redirects", root), "utf8");
  for (const [from, to] of moved) {
    assert.ok(!routes.includes(from), from);
    for (const path of [from.replace(/\/$/, ""), from])
      assert.ok(redirects.includes(`${path} ${to} 301\n`), path);
  }
  // The moved-page rules join the Meta feed rewrites; they never replace them.
  assert.ok(redirects.includes("/feeds/meta /feeds/meta.xml 200\n/feeds/meta/ /feeds/meta.xml 200\n"));
});
test("each page has one sign-up form: Home's band, the Updates page or the footer", async () => {
  const forms = async (file) =>
    [...(await readFile(new URL(file, root), "utf8")).matchAll(/<form class="signup" data-signup data-source="([^"]+)"/g)].map((match) => match[1]);
  for (const route of routes) {
    const expected = route === "/" ? "home" : route === "/updates/" ? "updates" : route.split("/")[1];
    assert.deepEqual(await forms(`${route.slice(1)}index.html`), [expected], route);
  }
  for (const file of ["checkout/index.html", "order/index.html"])
    assert.deepEqual(await forms(file), [], file);
  assert.match(await readFile(new URL("index.html", root), "utf8"), /class="updates-band"[\s\S]*data-source="home"/);
});
test("FAQ answers stay short and point to the page that owns each topic", () => {
  for (const { q, a, href } of answers) {
    assert.ok(a.length <= 140, `${q} has a ${a.length}-character answer`);
    assert.ok(href.startsWith("https://") || routes.includes(href), q);
  }
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
  // Scripts only the private admin pages load don't count toward the customer budget.
  const adminOnly = new Set();
  const referenced = async (file) => [...(await readFile(new URL(file, root), "utf8")).matchAll(/<script[^>]+src="\/_astro\/([^"]+\.js)"/g)].map((match) => match[1]);
  const adminPages = (await readdir(new URL("admin/", root), { recursive: true })).filter((file) => file.endsWith("index.html")).map((file) => `admin/${file}`);
  const customerPages = [...routes.map((route) => `${route.slice(1)}index.html`), "404.html"];
  const customerScripts = new Set((await Promise.all(customerPages.map(referenced))).flat());
  for (const name of (await Promise.all(adminPages.map(referenced))).flat()) if (!customerScripts.has(name)) adminOnly.add(name);
  assert.ok(adminOnly.size > 0, "the admin script is found");
  let jsBytes = 0;
  let adminBytes = 0;
  let workerVendorBytes = 0;
  const workerFiles = new Set(['partytown-sandbox-sw.html', 'partytown-sw.js', 'partytown-atomics.js', 'partytown.js', 'partytown-media.js']);
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
      else if (dir.pathname.endsWith('/~partytown/')) {
        assert.ok(workerFiles.has(item.name), `Unexpected worker vendor asset: ${item.name}`);
        const emitted = await readFile(new URL(item.name, dir));
        assert.deepEqual(emitted, await readFile(new URL(`../node_modules/@qwik.dev/partytown/lib/${item.name}`, import.meta.url)), 'Worker runtime must match the pinned dependency exactly');
        workerVendorBytes += emitted.length;
      } else if (item.name.endsWith(".js")) {
        const size = (await stat(new URL(item.name, dir))).size;
        if (adminOnly.has(item.name)) adminBytes += size;
        else jsBytes += size;
      }
    }
  };
  await walk(root);
  assert.ok(jsBytes < 65000, `All customer-facing first-party JS including checkout must stay under 65 KB; got ${jsBytes}`);
  assert.ok(adminBytes < 40000, `The private admin script must stay under 40 KB; got ${adminBytes}`);
  assert.ok(workerVendorBytes > 0 && workerVendorBytes < 160000, `The complete deferred third-party worker runtime must stay under 160 KB; got ${workerVendorBytes}`);
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
