import { getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;

// On-demand ISR. No build-time static generation.
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const collections = await getAllCollections();
    const collection = collections.find((c) => c.slug === slug);
    if (!collection) return { title: "Collection Not Found" };
    const isNewArrivals = collection.slug === "new-arrivals";
    return {
      title: isNewArrivals ? "New Arrivals Collection" : `${collection.name} Collection`,
      description: `${collection.description} Shop active, made-to-order graphic apparel from After Hours Agenda with clear fit, shipping, and return details.`.slice(0, 158),
      alternates: { canonical: isNewArrivals ? "/new-arrivals" : `/collections/${collection.slug}` },
    };
  } catch (error) {
    console.error("Error generating collection metadata:", error);
    return { title: "After Hours Agenda" };
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let collections: Collection[] = [];
  let products: Product[] = [];

  try {
    collections = await getAllCollections();
  } catch (error) {
    console.error("Error loading collections:", error);
    notFound();
  }

  const collection = collections.find((c) => c.slug === slug);
  if (!collection) notFound();

  try {
    products = await getProductsByCollection(collection.id);
  } catch (error) {
    console.error("Error loading collection products:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow={<span className="inline-flex items-center gap-3"><RouteBadge slug={slug} size="md" /> Collection</span>} title={collection.name} description={collection.description || "Browse every active piece in this collection."} />
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
