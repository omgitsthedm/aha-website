import { catalogCacheHeaders, currentCatalog, STATIC_PRODUCTS } from "../../server/catalog/current.mjs";
import { renderLivePage } from "../../server/catalog/render.mjs";

// Product pages for products published live. Built pages always win
// (preferStatic), so this only ever runs for a slug the build doesn't have.
// It renders from a built product page as the shell and reuses that page's
// security headers, so a live page is the same page a build would produce.
const SECURITY_HEADERS = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security", "x-robots-tag"];

async function notFound(origin, fetchImpl) {
  const page = await fetchImpl(`${origin}/404.html`).then((response) => (response.ok ? response.text() : "Not found")).catch(() => "Not found");
  return new Response(page, { status: 404, headers: { "content-type": "text/html; charset=utf-8", ...catalogCacheHeaders(["catalog-404"]), "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300" } });
}

export async function handleProductPage(request, { catalog = currentCatalog, fetchImpl = fetch } = {}) {
  const url = new URL(request.url);
  const [, shop, slug, extra] = url.pathname.split("/");
  if (shop !== "shop" || !slug) return notFound(url.origin, fetchImpl);
  if (!url.pathname.endsWith("/") && extra === undefined) return Response.redirect(`${url.origin}/shop/${slug}/${url.search}`, 301);
  const current = await catalog();
  const products = current.saleProducts ?? current.products;
  const product = (current.saleLiveProducts ?? current.liveProducts).find((entry) => entry.slug === slug);
  if (!product) return notFound(url.origin, fetchImpl);
  const shell = await fetchImpl(`${url.origin}/shop/${STATIC_PRODUCTS[0].slug}/`);
  if (!shell.ok) return new Response("Temporarily unavailable", { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } });
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", ...catalogCacheHeaders([`product:${slug}`]) });
  for (const name of SECURITY_HEADERS) { const value = shell.headers.get(name); if (value) headers.set(name, value); }
  return new Response(renderLivePage(await shell.text(), product, products), { status: 200, headers });
}

export default (request) => handleProductPage(request);

export const config = { path: ["/shop/:slug", "/shop/:slug/"], preferStatic: true };
