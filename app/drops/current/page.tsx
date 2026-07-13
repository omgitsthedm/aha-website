import type { Metadata } from "next";
import Link from "next/link";
import { getAllCollections, getAllProducts, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Collection, Product } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Current Release",
  description: "Shop the current After Hours Agenda release with live product availability, pricing, fit, production, shipping, and return details.",
  alternates: { canonical: "/drops/current" },
};

export default async function CurrentReleasePage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  let hasRelease = false;
  try {
    collections = await getAllCollections();
    const release = collections.find((collection) => /new arrivals?/i.test(collection.name));
    if (release) {
      products = await getProductsByCollection(release.id);
      hasRelease = products.length > 0;
    }
    if (!hasRelease) products = await getAllProducts();
  } catch (error) {
    console.error("Failed to load current release:", error);
  }

  return <main className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-7xl"><PageHeader eyebrow="Current release / Active catalog" title={hasRelease ? "Current release" : "No separate release is active"} description={hasRelease ? "The newest active products, gathered as one release. Product pages carry the current price, available variants, production timing, and return summary." : "Nothing is being presented as a timed release right now. The full active catalog remains available without a fake countdown."} /><div className="mb-10 flex flex-wrap gap-3"><Link href="#release-products" className="primary-action min-h-11 px-5 py-3 text-xs">{hasRelease ? "Shop this release" : "Browse the active catalog"}</Link><Link href="/drops/archive" className="secondary-action min-h-11 px-5 py-3 text-xs">Open release archive</Link></div><div id="release-products"><ShopContent products={products} collections={collections} /></div></div></main>;
}
