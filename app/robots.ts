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
          "/shop/",
          "/men",
          "/men/",
          "/women",
          "/women/",
          "/unisex",
          "/accessories",
          "/new-arrivals",
          "/product/",
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
          "/best-sellers",
          "/coming-soon",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
