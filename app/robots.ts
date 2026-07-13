import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/shop",
          "/about",
          "/faq",
          "/shipping",
          "/returns",
          "/care",
          "/size-guide",
          "/track-order",
          "/contact",
          "/newsletter",
          "/restock",
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
          "/product/",
          "/collections/",
          "/drops/",
          "/lookbook/",
          "/catalog-edit",
          "/new-arrivals",
          "/best-sellers",
          "/coming-soon",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
