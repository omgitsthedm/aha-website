import { imageStore } from "../../server/catalog/live.mjs";

// Images for products published live, at the same /images/... paths a build
// would later serve as static files (built files always win: preferStatic).
const TYPES = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const PATH = /^\/images\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\.(webp|jpg|jpeg|png)$/;

export async function handleCatalogImage(request, { store = imageStore } = {}) {
  const match = PATH.exec(new URL(request.url).pathname);
  if (!match) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const [, group, slug, name, extension] = match;
  let data = null;
  try { data = await store().get(`${group}/${slug}/${name}.${extension}`, { type: "arrayBuffer" }); } catch { data = null; }
  if (!data) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": TYPES[extension],
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=86400",
      "netlify-cdn-cache-control": "public, durable, s-maxage=31536000",
      "netlify-cache-tag": `catalog-images,product:${slug}`,
    },
  });
}

export default (request) => handleCatalogImage(request);

export const config = { path: "/images/:group/:slug/:file", preferStatic: true };
