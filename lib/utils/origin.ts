/**
 * The public origin the shopper actually reached — for building redirect URLs in
 * route handlers. On Netlify, `request.url` is the INTERNAL function URL (a deploy
 * hostname), so a redirect built from it can bounce the user to a deploy-preview
 * domain instead of the canonical site. Prefer the configured canonical origin,
 * then the forwarded host the edge saw, then fall back to the request origin.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return "https://afterhoursagenda.com";
  }
}
