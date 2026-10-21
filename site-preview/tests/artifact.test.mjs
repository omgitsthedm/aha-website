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
test("executable inline scripts are covered by CSP without per-product JSON hashes", async () => {
  const { createHash } = await import("node:crypto");
  const headers = await readFile(new URL("_headers", root), "utf8");
  for (const route of [...routes, "/404.html"]) {
    const file = route.endsWith(".html")
      ? route.slice(1)
      : `${route.slice(1)}index.html`;
    const html = await readFile(new URL(file, root), "utf8");
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[2]) continue;
      const hash = createHash("sha256").update(match[2]).digest("base64");
      if (/\btype\s*=\s*(["'])application\/(?:ld\+)?json\1/i.test(match[1])) {
        assert.doesNotThrow(() => JSON.parse(match[2]), `${route}: valid embedded data`);
        assert.ok(!headers.includes(hash), `${route}: inert data must not expand script policy`);
      } else
        assert.ok(
          headers.includes(hash), `${route}: executable script must be authorized`,
        );
    }
  }
  assert.ok(headers.length < 6000, `Security headers must stay compact as the catalog grows (${headers.length} bytes)`);
  const scriptPolicy = headers.match(/script-src ([^;]+)/)?.[1] ?? "";
  assert.ok(!scriptPolicy.includes("unsafe-inline"));
  assert.match(headers, /style-src 'self' 'unsafe-inline'/, "Square requires its dynamic UI styles");
  assert.match(headers, /payment=\(self/, "Wallet payment requests must be permitted");
  assert.ok(!headers.includes("unsafe-eval"));
  assert.match(headers, /connect-src 'self'/);
  // Since GA4 was linked to Google Ads, gtag also sends each hit to www.google.com/g/collect.
  assert.equal(/connect-src [^;\n]*https:\/\/www\.google\.com\/g\/[ ;\n]/.test(headers), production);
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
  for (const tenet of ["Wear it your way.", "Check the fit.", "Look closer.", "Keep it in rotation."])
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
test("the FAQ page marks up every question and answer", async () => {
  const page = await readFile(new URL("faq/index.html", root), "utf8");
  const graph = JSON.parse(page.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@graph"[\s\S]*?)<\/script>/)[1])["@graph"];
  const faq = graph.find((node) => node["@type"] === "FAQPage");
  assert.deepEqual(faq.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]), answers.map((item) => [item.q, item.a]));
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
  // Scripts only the private admin pages load don't count toward the storefront
  // budget, and neither do the scripts only the private order and account pages
  // load (they have their own cap): the 65 KB keeps the public pages fast.
  const adminOnly = new Set();
  const privateOnly = new Set();
  const referenced = async (file) => [...(await readFile(new URL(file, root), "utf8")).matchAll(/<script[^>]+src="\/_astro\/([^"]+\.js)"/g)].map((match) => match[1]);
  const adminPages = (await readdir(new URL("admin/", root), { recursive: true })).filter((file) => file.endsWith("index.html")).map((file) => `admin/${file}`);
  const customerPages = [...routes.map((route) => `${route.slice(1)}index.html`), "404.html", "checkout/index.html"];
  const customerScripts = new Set((await Promise.all(customerPages.map(referenced))).flat());
  for (const name of (await Promise.all(adminPages.map(referenced))).flat()) if (!customerScripts.has(name)) adminOnly.add(name);
  for (const name of (await Promise.all(["order/index.html", "account/index.html", "unsubscribe/index.html"].map(referenced))).flat()) if (!customerScripts.has(name)) privateOnly.add(name);
  assert.ok(adminOnly.size > 0, "the admin script is found");
  // The unsubscribe page's script is small enough that Astro inlines it (CSP-hashed).
  assert.ok(privateOnly.size >= 2, "the order and account page scripts are found");
  let jsBytes = 0;
  let adminBytes = 0;
  let privateBytes = 0;
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
        else if (privateOnly.has(item.name)) privateBytes += size;
        else jsBytes += size;
      }
    }
  };
  await walk(root);
  assert.ok(jsBytes < 65000, `All public storefront first-party JS including checkout must stay under 65 KB; got ${jsBytes}`);
  assert.ok(privateBytes < 12000, `The private order, account and unsubscribe page scripts must stay under 12 KB; got ${privateBytes}`);
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

test("products off sale leave the sitemap, llms.txt and feeds, and their pages are noindex and discontinued", async () => {
  const { OFF_SALE, onSale } = await import("../server/catalog/off-sale.mjs");
  const all = JSON.parse(await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"));
  assert.ok(OFF_SALE.length && OFF_SALE.every((slug) => all.some((product) => product.slug === slug)), "every off-sale slug is a product");
  const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
  const llms = await readFile(new URL("llms.txt", root), "utf8");
  const feed = await readFile(new URL("feeds/google.xml", root), "utf8");
  for (const slug of OFF_SALE) {
    const product = all.find((entry) => entry.slug === slug);
    assert.ok(!sitemap.includes(`/shop/${slug}/`), `${slug} in sitemap`);
    assert.ok(!llms.includes(`${product.title}: $${product.price}, ${product.color}`), `${slug} in llms.txt`);
    assert.ok(!feed.includes(product.variants[0].id), `${slug} in feed`);
    const page = await readFile(new URL(`shop/${slug}/index.html`, root), "utf8");
    assert.match(page, /<meta name="robots" content="noindex, noarchive">/);
    assert.ok(page.includes('"availability":"https://schema.org/Discontinued"'));
    assert.match(await readFile(new URL("shop/index.html", root), "utf8"), new RegExp(`<article class="product-card" data-type="[a-z-]+" data-off-sale="${slug}" hidden>`));
  }
  for (const product of onSale(all)) assert.ok(sitemap.includes(`/shop/${product.slug}/`), product.slug);
  // Dates come from the built commit, not a fixed day.
  const [lastmod] = sitemap.match(/<lastmod>([^<]+)<\/lastmod>/).slice(1);
  assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(JSON.parse(await readFile(new URL("release.json", root), "utf8")).reviewed, lastmod);
  assert.ok(llms.includes("Updated ") && !llms.includes("Reviewed October 15"));
});
test("search and shopping crawlers are welcome; AI training crawlers are not", async () => {
  const robots = await readFile(new URL("robots.txt", root), "utf8");
  for (const bot of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot"]) assert.ok(robots.includes(`User-agent: ${bot}\nAllow: /`), bot);
  for (const bot of ["GPTBot", "ClaudeBot"]) assert.ok(robots.includes(`User-agent: ${bot}\nDisallow: /`), bot);
});
test("every product offer states delivery time and the 30-day free-return policy", async () => {
  const page = await readFile(new URL("shop/yikes-crewneck/index.html", root), "utf8");
  const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"ProductGroup"[\s\S]*?)<\/script>/)[1]);
  const offer = schema.hasVariant[0].offers;
  assert.equal(offer.hasMerchantReturnPolicy.merchantReturnDays, 30);
  assert.equal(offer.hasMerchantReturnPolicy.returnFees, "https://schema.org/FreeReturn");
  assert.deepEqual([offer.shippingDetails.deliveryTime.handlingTime.minValue, offer.shippingDetails.deliveryTime.transitTime.maxValue], [5, 6]);
});
test("every product page names its blank and says where it's printed", async () => {
  const all = JSON.parse(await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"));
  for (const product of all) assert.ok(product.blank, `${product.slug} has no blank`);
  const page = (slug) => readFile(new URL(`shop/${slug}/index.html`, root), "utf8");
  // Mighty Mick's designs are recorded as DTG (Apliiq placement 4546, service dtgprint).
  assert.ok((await page("mighty-micks-ss3000-navy")).includes("<li>Blank: Independent Trading Co. SS3000.</li><li>Printed to order in the United States, direct to garment (DTG).</li>"));
  // Without a recorded print method, the page doesn't guess one.
  assert.ok((await page("insomniac-ss4500-black")).includes("<li>Blank: Independent Trading Co. SS4500.</li><li>Printed to order in the United States.</li>"));
});
test("The story tells the founder's story and the schema names the founder", async () => {
  const page = await readFile(new URL("about/index.html", root), "utf8");
  assert.match(page, /id="founder"/);
  assert.ok(page.includes("David Marsh’s clothing label"));
  assert.ok(page.includes("<cite>Hit the Ground Running</cite>, 2013"));
  assert.ok(page.includes('"founder":{"@type":"Person","name":"David Marsh"}'));
});
