import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/square/catalog";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

// Only routes that resolve to a real, canonical page belong here.
// Routes that currently redirect to "/" (about, lookbook, newsletter, restock)
// are added back when their pages go live.
const publicPages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
  { path: "/shop/t-shirts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/shop/hoodies-sweatshirts", priority: 0.8, changeFrequency: "weekly" },
  // The gender and empty-category routes still resolve, but they are not linked
  // from the storefront and describe a range the capsule does not have; a
  // sitemap should advertise the doors people are meant to use.
  { path: "/manifesto", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/newsletter", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/shipping", priority: 0.6, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.6, changeFrequency: "monthly" },
  { path: "/care", priority: 0.6, changeFrequency: "monthly" },
  { path: "/size-guide", priority: 0.6, changeFrequency: "monthly" },
  { path: "/track-order", priority: 0.6, changeFrequency: "monthly" },
  // /gift-cards is intentionally omitted while GIFT_CARDS_ENABLED is off (the
  // route is a "coming soon" stub). Add it back when the flow ships.
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" },
  { path: "/accessibility", priority: 0.4, changeFrequency: "yearly" },
];

// NOTE ON `lastmod`: it is deliberately absent.
//
// Every entry previously carried `new Date()`, evaluated when the sitemap was
// rendered — so all 152 URLs shared one timestamp that moved on every request
// and described nothing. Google discounts a `lastmod` it can prove is not a
// modification date, and a whole sitemap of them teaches it to distrust the
// field site-wide. Omitting is strictly better than asserting something false.
//
// Restoring it needs a real per-URL date, which this file cannot reach today:
//   - products: Square returns `updated_at` on every catalog object, but
//     `Product` (lib/utils/types.ts) does not carry it and
//     `mapSquareItemToProduct` (lib/utils/mappers.ts) drops it.
//   - static pages: the git commit date for each route's source file, captured
//     at build time — the deployed serverless bundle has no `.git`.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogPaths = new Set(["/shop", "/shop/t-shirts", "/shop/hoodies-sweatshirts"]);
  const staticEntries: MetadataRoute.Sitemap = publicPages
    .filter((page) => isStorefrontPublic() || !catalogPaths.has(page.path))
    .map((page) => ({
    url: `${BASE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await getAllProducts();
    productEntries = products.map((product) => ({
      url: `${BASE_URL}/product/${product.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (error) {
    console.error("Sitemap: failed to load products, emitting static pages only:", error);
  }

  return [...staticEntries, ...productEntries];
}
