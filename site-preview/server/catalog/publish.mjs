// Write side of the live catalog, behind the admin automation token. The
// publish engine uploads a product's images first, then the product; the
// product is refused unless every image it references is already stored, so a
// live page can never point at a missing file. Publishing or removing a
// product purges the CDN tags of the pages, images, feeds and JSON that show
// it, once: Netlify limits each tag to two purges per five seconds, so image
// uploads never purge (a missing image is never cached, and image responses
// carry the product's tag).
import { purgeCache } from "@netlify/functions";
import { currentCatalog } from "./current.mjs";
import { imageStore as defaultImageStore, catalogStore as defaultCatalogStore, LiveCatalogError, readSnapshot, removeLiveProduct, upsertLiveProduct, validateLiveProduct } from "./live.mjs";

const IMAGE = /^([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+\.(webp|jpg|jpeg|png))$/;
const TYPES = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const SIGNATURES = {
  webp: (bytes) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50,
  jpg: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
};
SIGNATURES.jpeg = SIGNATURES.jpg;

export function productImageKeys(product) {
  const paths = product.gallery.flatMap((shot) => [shot.src, shot.feedImage, ...shot.srcset.split(",").map((part) => part.trim().split(/\s+/)[0])]);
  return [...new Set(paths.map((value) => value.replace(/^\/images\//, "")))];
}

const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function createLivePublisher({ catalogStore = defaultCatalogStore, imageStore = defaultImageStore, purge = (tags) => purgeCache({ tags }), now = () => new Date(), retryDelayMs = 5_500 } = {}) {
  // The snapshot is already saved when this runs; a failed purge only delays
  // what the CDN shows, so it is retried once and then reported, never thrown.
  async function purgeOnce(tags) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { await purge(tags); return true; }
      catch { if (attempt === 0) await pause(retryDelayMs); }
    }
    return false;
  }
  return {
    catalog: () => currentCatalog(),
    purge: purgeOnce,
    async list() {
      const snapshot = await readSnapshot(catalogStore());
      return Object.values(snapshot.products).map((product) => ({ slug: product.slug, title: product.title, color: product.color, price: product.price, publishedAt: product.publishedAt, updatedAt: product.updatedAt }));
    },
    async putImage(key, bytes) {
      const match = IMAGE.exec(key);
      if (!match) throw new LiveCatalogError("Image path must be <collection>/<slug>/<file>.webp|jpg|png.");
      const view = new Uint8Array(bytes);
      if (!view.length || view.length > MAX_IMAGE_BYTES) throw new LiveCatalogError("Image must be between 1 byte and 6 MB.");
      if (!SIGNATURES[match[4]](view)) throw new LiveCatalogError(`File content isn't a ${match[4]} image.`);
      await imageStore().set(key, bytes, { metadata: { contentType: TYPES[match[4]] } });
      return { key, bytes: view.length };
    },
    async putProduct(slug, product) {
      if (product?.slug !== slug) throw new LiveCatalogError("The product slug must match the URL.");
      validateLiveProduct(product);
      const images = imageStore();
      const missing = [];
      for (const key of productImageKeys(product)) if (!(await images.getMetadata(key))) missing.push(key);
      if (missing.length) throw new LiveCatalogError(`Upload these images first: ${missing.slice(0, 10).join(", ")}.`);
      const saved = await upsertLiveProduct(product, { store: catalogStore(), now });
      const purged = await purgeOnce(["catalog", `product:${slug}`]);
      return { slug, publishedAt: saved.publishedAt, updatedAt: saved.updatedAt, url: `/shop/${slug}/`, purged };
    },
    async removeProduct(slug) {
      const removed = await removeLiveProduct(slug, { store: catalogStore(), now });
      const purged = removed ? await purgeOnce(["catalog", `product:${slug}`]) : true;
      return { slug, removed, purged };
    },
  };
}
