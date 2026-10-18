import { feedXml, gzipFeed, openAiFeedJsonl } from "../../scripts/feeds.mjs";
import { catalogCacheHeaders, currentCatalog, STATIC_PRODUCTS } from "../../server/catalog/current.mjs";
import { SITE_ORIGIN } from "../../server/platform/client.mjs";

// Google/Meta feeds and the live-product sitemap. The feeds replace the built
// files so products published live are advertised the moment they can be
// bought; with nothing published live they are byte-identical to the build.
const PRODUCTION_ORIGIN = SITE_ORIGIN;

export async function handleFeeds(request, context, { catalog = currentCatalog } = {}) {
  const url = new URL(request.url);
  const origin = context?.deploy?.context === "production" ? PRODUCTION_ORIGIN : url.origin;
  let products = STATIC_PRODUCTS;
  let live = [];
  try {
    const current = await catalog();
    products = current.saleProducts ?? current.products;
    live = current.saleLiveProducts ?? current.liveProducts;
  } catch { /* built products only */ }
  if (url.pathname === "/sitemap-live.xml") {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${live.map((product) => `<url><loc>${origin}/shop/${product.slug}/</loc><lastmod>${String(product.updatedAt ?? product.publishedAt ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10)}</lastmod></url>`).join("")}</urlset>\n`;
    return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", ...catalogCacheHeaders(["sitemap"]) } });
  }
  if (url.pathname === "/feeds/openai.jsonl.gz") {
    return new Response(gzipFeed(openAiFeedJsonl(products, origin)), { headers: { "content-type": "application/gzip", ...catalogCacheHeaders(["feeds"]) } });
  }
  const channel = url.pathname === "/feeds/meta.xml" ? "meta" : "google";
  return new Response(feedXml(products, origin, channel), { headers: { "content-type": "application/xml; charset=utf-8", ...catalogCacheHeaders(["feeds"]) } });
}

export default (request, context) => handleFeeds(request, context);

export const config = { path: ["/feeds/google.xml", "/feeds/meta.xml", "/feeds/openai.jsonl.gz", "/sitemap-live.xml"] };
