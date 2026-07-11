import Link from "next/link";
import { getAllCollections, getAllProducts, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Collection, Product } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = { title: "Drops", description: "The active After Hours Agenda drop and made-to-order catalog.", alternates: { canonical: "/drops" } };

export default async function DropsPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  let usingNewArrivals = false;
  try {
    collections = await getAllCollections();
    const newArrivals = collections.find((collection) => /new arrivals?/i.test(collection.name));
    if (newArrivals) {
      products = await getProductsByCollection(newArrivals.id);
      usingNewArrivals = products.length > 0;
    }
    if (!usingNewArrivals) products = await getAllProducts();
  } catch (error) {
    console.error("Failed to load drops:", error);
  }

  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-7xl"><PageHeader eyebrow={usingNewArrivals ? "Current New Arrivals collection" : "Current active catalog"} title="The drop" description={usingNewArrivals ? "Every active piece currently assigned to New Arrivals." : "No populated New Arrivals collection is available, so this page shows the active catalog without implying limited stock or release timing."} /><div className="mb-10 flex flex-wrap gap-3"><Link href="#drop-grid" className="primary-action min-h-11 px-5 py-3 text-xs">Browse pieces</Link><Link href="/#newsletter" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Get release updates</Link></div><div id="drop-grid"><ShopContent products={products} collections={collections} /></div></div></div>;
}
