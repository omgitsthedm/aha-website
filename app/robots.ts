import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

const CANONICAL_HOST = new URL(BASE_URL).host.toLowerCase();

/**
 * `afterhoursagenda.netlify.app` serves the whole storefront a second time, so
 * all 152 URLs exist on two hosts. Deliberately narrow: only a `*.netlify.app`
 * host that is NOT the configured canonical host is closed off, so a
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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";

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
        disallow: [
          "/api/",
          "/ops/",
          "/cart",
          "/checkout",
          "/order-confirmed",
          "/collections/",
          "/drops/",
          "/catalog-edit",
          "/coming-soon",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
