import { catalogCacheHeaders, currentCatalog } from "../../server/catalog/current.mjs";
import { productCard } from "../../server/catalog/render.mjs";

// Products published live, for pages built before they existed: the shop page
// shows their cards and the cart accepts their sizes. Rendered and escaped
// here; the browser only inserts the cards.
export async function handleLiveCatalog(_request, { catalog = currentCatalog } = {}) {
  let liveProducts = [];
  try { ({ liveProducts } = await catalog()); } catch { liveProducts = []; }
  const body = {
    products: liveProducts.map((product) => ({ slug: product.slug, collection: product.collection, card: productCard(product) })),
    cartLines: liveProducts.flatMap((product) => product.variants.map((variant) => ({
      id: variant.id, sku: variant.sku, size: variant.size, slug: product.slug,
      title: `${product.title} — ${product.color}`, color: product.color, priceCents: product.price * 100,
      image: product.gallery[0].src, imageAlt: product.gallery[0].alt,
    }))),
  };
  return Response.json(body, { headers: catalogCacheHeaders(["live-json"]) });
}

export default (request) => handleLiveCatalog(request);

export const config = { path: "/api/catalog/live" };
