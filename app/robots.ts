import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

const CANONICAL_HOST = new URL(BASE_URL).host.toLowerCase();

const DENIED_TRAINING_AND_BULK_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "Applebot-Extended",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "PetalBot",
  "DataForSeoBot",
] as const;

/**
 * `afterhoursagenda.netlify.app` serves the whole storefront a second time, so
 * the storefront exists on two hosts. Deliberately narrow: only a
 * `*.netlify.app` host that is NOT the configured canonical host is closed off, so a
 * misconfigured `NEXT_PUBLIC_SITE_URL` can never de-index the real apex.
 *
 * This is a crawler directive only — it does not redirect and does not touch
 * `/api/webhooks/square`, whose Square signature HMAC includes that exact
 * hostname (`netlify.toml:27`). Redirecting the subdomain would break payment
 * reconciliation; this does not.
 */
function isNonCanonicalHost(host: string): boolean {
  return host.endsWith(".netlify.app") && host !== CANONICAL_HOST;
}

export function robotsForHost(host: string): MetadataRoute.Robots {
  if (isNonCanonicalHost(host)) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      // No sitemap advertised from a host that should not be crawled, and the
      // canonical apex is named so a crawler that arrives here still knows where
      // the real site lives.
      host: BASE_URL,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/shop",
          "/shop/",
          "/men",
          "/men/",
          "/women",
          "/women/",
          "/unisex",
          "/accessories",
          "/new-arrivals",
          "/product/",
          "/manifesto",
          "/about",
          "/lookbook",
          "/newsletter",
          "/restock",
          "/faq",
          "/shipping",
          "/returns",
          "/care",
          "/size-guide",
          "/track-order",
          "/contact",
          "/privacy",
          "/terms",
          "/accessibility",
        ],
        // Deliberately short. A `Disallow` blocks the *fetch*, so anything that
        // relies on the response being read must NOT appear here:
        //   - /cart and /checkout carry `robots: { index: false }` in their own
        //     metadata (app/cart/page.tsx:7, app/checkout/page.tsx:7). Blocking
        //     the crawl means Google never reads that noindex and can still
        //     index the URL from inbound links, which is the opposite outcome.
        //   - /collections/* and /drops/* are redirects (next.config.mjs
        //     `retiredPublicRoutes`). A blocked redirect cannot pass its signal
        //     to the destination.
        // /order-confirmed stays: it is only reachable with a live order token,
        // has no noindex to read, and nothing should be following it.
        // /catalog-edit and /coming-soon also redirect, but they are internal
        // routes that never had public links, so there is no signal to pass on
        // and blocking the fetch costs nothing.
        disallow: [
          "/api/",
          "/ops/",
          "/order-confirmed",
          "/catalog-edit",
          "/coming-soon",
        ],
      },
      // Public search, user-requested retrieval, and ads crawlers intentionally
      // inherit the wildcard rule above. These named agents are restricted to
      // model-training/corpus collection and high-volume SEO harvesting.
      ...DENIED_TRAINING_AND_BULK_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  return robotsForHost(host);
}
