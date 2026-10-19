import { feedXml, gzipFeed, openAiFeedJsonl } from "../../scripts/feeds.mjs";
import { catalogCacheHeaders, currentCatalog, STATIC_PRODUCTS } from "../../server/catalog/current.mjs";
import { SITE_ORIGIN } from "../../server/platform/client.mjs";
import { DROPS, releasedProducts, secondsToNextRelease } from "../../server/catalog/drops.mjs";

// Google/Meta feeds and the live-product sitemap. The feeds replace the built
// files so products published live are advertised the moment they can be
// bought; with nothing published live they are byte-identical to the build.
const PRODUCTION_ORIGIN = SITE_ORIGIN;

export async function handleFeeds(request, context, { catalog = currentCatalog, drops = DROPS, now = Date.now() } = {}) {
  const url = new URL(request.url);
  const origin = context?.deploy?.context === "production" ? PRODUCTION_ORIGIN : url.origin;
  let products = STATIC_PRODUCTS;
  let live = [];
  try {
    const current = await catalog();
    products = current.saleProducts ?? current.products;
    live = current.saleLiveProducts ?? current.liveProducts;
  } catch { /* built products only */ }
  // Drops appear in feeds when they open to everyone; until then the CDN copy expires at the next release.
  products = releasedProducts(products, now, drops);
  const untilRelease = secondsToNextRelease(now, drops);
  const cacheHeaders = (tags) => {
    const headers = catalogCacheHeaders(tags);
    return untilRelease ? { ...headers, "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${untilRelease}` } : headers;
  };
  if (url.pathname === "/sitemap-live.xml") {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${live.map((product) => `<url><loc>${origin}/shop/${product.slug}/</loc><lastmod>${String(product.updatedAt ?? product.publishedAt ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10)}</lastmod></url>`).join("")}</urlset>\n`;
    return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", ...catalogCacheHeaders(["sitemap"]) } });
  }
  if (url.pathname === "/feeds/openai.jsonl.gz") {
    return new Response(gzipFeed(openAiFeedJsonl(products, origin)), { headers: { "content-type": "application/gzip", ...cacheHeaders(["feeds"]) } });
  }
  const channel = url.pathname === "/feeds/meta.xml" ? "meta" : "google";
  return new Response(feedXml(products, origin, channel), { headers: { "content-type": "application/xml; charset=utf-8", ...cacheHeaders(["feeds"]) } });
}

export default (request, context) => handleFeeds(request, context);

export const config = { path: ["/feeds/google.xml", "/feeds/meta.xml", "/feeds/openai.jsonl.gz", "/sitemap-live.xml"] };
