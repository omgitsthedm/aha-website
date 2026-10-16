import { CLIENT } from "../../server/platform/client.mjs";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

// Keep Meta's CORS workaround deliberately narrower than a general fetch proxy.
// The pixel and its known configuration script are the only upstream resources.
const sources = Object.freeze({
  "/api/partytown/meta-pixel/bootstrap": "https://connect.facebook.net/en_US/fbevents.js",
  "/api/partytown/meta-pixel/config": `https://connect.facebook.net/signals/config/${CLIENT.analytics.metaPixel}`,
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

export default async function handler(request, context) {
  if (!requireProductionRequest(request, context) || !["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 404 });
  const source = sources[new URL(request.url).pathname];
  if (!source) return new Response(null, { status: 404 });
  let upstream;
  try {
    upstream = await fetchMetaPixel(source);
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok) return new Response(null, { status: 502 });
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "content-type": "application/javascript; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export const config = { path: "/api/partytown/meta-pixel/*", method: ["GET", "HEAD"] };
