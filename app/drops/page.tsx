import Link from "next/link";
import { getAllCollections, getAllProducts, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Collection, Product } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = { title: "Current Drop Bulletin", description: "Read the current After Hours Agenda drop bulletin and shop the active release or design index with live pricing, sizing, and honest availability.", alternates: { canonical: "/drops" } };

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

  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-7xl"><PageHeader eyebrow={usingNewArrivals ? "Drop bulletin / Now on the wall" : "Drop bulletin / Between releases"} title={usingNewArrivals ? "The current drop" : "The archive stays open"} description={usingNewArrivals ? "The newest active pieces in one place. Availability is shown as it exists—no manufactured countdowns, mystery quantities, or borrowed urgency." : "There is no separate release on the wall right now, so the active design index remains open. Join the dispatch for the next real release notice."} /><div className="mb-10 flex flex-wrap gap-3"><Link href="#drop-grid" className="primary-action min-h-11 px-5 py-3 text-xs">{usingNewArrivals ? "Shop the current drop" : "Browse the active archive"}</Link><Link href="/#newsletter" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Get the next bulletin</Link></div><div id="drop-grid"><ShopContent products={products} collections={collections} /></div></div></div>;
}
