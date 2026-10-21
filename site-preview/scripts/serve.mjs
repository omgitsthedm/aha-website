import client from "../client.config.json" with { type: "json" };
import http from "node:http";
import { gzipSync } from "node:zlib";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const port = Number(process.env.PORT || 48379);
const metaPixelSources = Object.freeze({
  "/api/partytown/meta-pixel/bootstrap": "https://connect.facebook.net/en_US/fbevents.js",
  "/api/partytown/meta-pixel/config": `https://connect.facebook.net/signals/config/${client.analytics.metaPixel}`,
});
async function fetchMetaPixel(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(source, { headers: { Accept: "application/javascript" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const config = await readFile(resolve(root, "_headers"), "utf8");
const headerRules = [];
for (const line of config.split("\n")) {
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  if (line.startsWith("/")) headerRules.push({ path: line.trim(), headers: {} });
  else {
    const index = line.indexOf(":");
    if (index > 0 && headerRules.length) {
      headerRules.at(-1).headers[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
}
// Exact-path redirects from the built _redirects file, as Netlify serves them.
// 200 rewrites (the Meta feed) are served by the static handler below.
const redirects = new Map(
  (await readFile(resolve(root, "_redirects"), "utf8").catch(() => ""))
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([from, to, status = "301"]) => from?.startsWith("/") && to && /^30[1278]$/.test(status))
    .map(([from, to, status]) => [from, { to, status: Number(status) || 301 }]),
);
function headersFor(pathname) {
  const result = {};
  for (const rule of headerRules) {
    const matches = rule.path.endsWith("*")
      ? pathname.startsWith(rule.path.slice(0, -1))
      : pathname === rule.path;
    if (matches) Object.assign(result, rule.headers);
  }
  return result;
}
// Browser tests run the real account and review handlers on an in-memory database.
const localAccounts = process.env.AHA_LOCAL_ACCOUNTS === "1" ? await (await import("./local-accounts.mjs")).createLocalAccounts(port) : null;
http
  .createServer(async (req, res) => {
    let headers = headersFor("/");
    try {
      if (localAccounts && await localAccounts(req, res, new URL(req.url, "http://localhost").pathname)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, headers);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      headers = headersFor(pathname);
      if (pathname.includes("\0")) throw new Error("Invalid path");
      const redirect = redirects.get(pathname);
      if (redirect) {
        res.writeHead(redirect.status, { ...headers, Location: redirect.to });
        res.end();
        return;
      }
      const metaPixelSource = metaPixelSources[pathname];
      if (metaPixelSource) {
        let upstream;
        try {
          upstream = await fetchMetaPixel(metaPixelSource);
        } catch {
          res.writeHead(502, headers);
          res.end();
          return;
        }
        if (!upstream.ok) {
          res.writeHead(502, headers);
          res.end();
          return;
        }
        const body = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, {
          ...headers,
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          "Content-Length": body.length,
          "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? undefined : body);
        return;
      }
      // netlify/functions/checkout-config.mjs answers this in production. A
      // One Size piece selects itself, so its page asks at once which wallets
      // are on; the local preview has no Square, so every method is off and
      // the page loads nothing more (tests mock this route when they need it).
      if (pathname === "/api/checkout/config") {
        const body = Buffer.from(JSON.stringify({ appId: "local-preview", applicationId: "local-preview", locationId: "local-preview", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }));
        res.writeHead(200, { ...headers, "Content-Type": "application/json", "Content-Length": body.length, "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : body);
        return;
      }
      // netlify/functions/catalog-live.mjs answers this in production; the
      // built artifact has nothing published live, so it is always empty here.
      if (pathname === "/api/catalog/live") {
        // AHA_LOCAL_RETIRED=slug,slug simulates products removed in the admin (local checks only).
        // By default the local server agrees with production: products off sale stay off sale.
        const offSale = JSON.parse(await readFile(resolve(root, "../src/data/off-sale.json"), "utf8")).products;
        const retired = (process.env.AHA_LOCAL_RETIRED ?? offSale.join(",")).split(",").map((slug) => slug.trim()).filter(Boolean);
        const products = JSON.parse(await readFile(resolve(root, "../src/data/products.json"), "utf8"));
        const retiredVariations = products.filter((product) => retired.includes(product.slug)).flatMap((product) => product.variants.map((variant) => variant.id));
        const body = Buffer.from(JSON.stringify({ known: true, retired, retiredVariations, products: [], cartLines: [] }));
        res.writeHead(200, { ...headers, "Content-Type": "application/json", "Content-Length": body.length, "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : body);
        return;
      }
      let path = resolve(root, `.${pathname}`);
      if (pathname === '/feeds/meta' || pathname === '/feeds/meta/') path=resolve(root,'feeds/meta.xml');
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403, headers);
        res.end();
        return;
      }
      let status = 200;
      try {
        if ((await stat(path)).isDirectory())
          path = resolve(path, "index.html");
        await stat(path);
      } catch {
        path = resolve(root, "404.html");
        status = 404;
      }
      const body = await readFile(path);
      const compressed =
        /gzip/.test(req.headers["accept-encoding"] || "") &&
        /\.(html|css|js|svg|json|txt|xml|webmanifest)$/.test(path);
      const payload = compressed ? gzipSync(body) : body;
      res.writeHead(status, {
        ...headers,
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        Vary: "Accept-Encoding",
        "Content-Length": payload.length,
        ...(compressed ? { "Content-Encoding": "gzip" } : {}),
      });
      res.end(req.method === "HEAD" ? undefined : payload);
    } catch {
      res.writeHead(400, headers);
      res.end("Bad request");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`After Hours Agenda static preview: http://127.0.0.1:${port}`),
  );
