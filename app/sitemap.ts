import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/square/catalog";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

// Only routes that resolve to a real, canonical page belong here.
// Routes that currently redirect to "/" (about, lookbook, newsletter, restock)
// are added back when their pages go live.
const publicPages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
  { path: "/men", priority: 0.9, changeFrequency: "weekly" },
  { path: "/men/t-shirts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/men/hoodies-sweatshirts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/men/sweaters-knitwear", priority: 0.8, changeFrequency: "weekly" },
  { path: "/men/accessories", priority: 0.7, changeFrequency: "weekly" },
  { path: "/women", priority: 0.9, changeFrequency: "weekly" },
  { path: "/women/t-shirts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/women/hoodies-sweatshirts", priority: 0.8, changeFrequency: "weekly" },
  { path: "/women/sweaters-knitwear", priority: 0.8, changeFrequency: "weekly" },
  { path: "/women/accessories", priority: 0.7, changeFrequency: "weekly" },
  { path: "/unisex", priority: 0.9, changeFrequency: "weekly" },
  { path: "/accessories", priority: 0.8, changeFrequency: "weekly" },
  { path: "/new-arrivals", priority: 0.8, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/shipping", priority: 0.6, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.6, changeFrequency: "monthly" },
  { path: "/care", priority: 0.6, changeFrequency: "monthly" },
  { path: "/size-guide", priority: 0.6, changeFrequency: "monthly" },
  { path: "/track-order", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" },
  { path: "/accessibility", priority: 0.4, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicPages.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await getAllProducts();
    productEntries = products.map((product) => ({
      url: `${BASE_URL}/product/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (error) {
    console.error("Sitemap: failed to load products, emitting static pages only:", error);
  }

  return [...staticEntries, ...productEntries];
}
