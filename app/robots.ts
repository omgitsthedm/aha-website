import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/cart", "/checkout", "/order-confirmed"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
