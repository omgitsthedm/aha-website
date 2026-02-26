import { getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";
import { getLineForCollection } from "@/lib/utils/subway-lines";

export const revalidate = 300;

// On-demand ISR — no build-time static generation
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const collections = await getAllCollections();
    const collection = collections.find((c) => c.slug === params.slug);
    if (!collection) return { title: "Collection Not Found | After Hours Agenda" };
    return {
      title: `${collection.name} | After Hours Agenda`,
      description: collection.description,
    };
  } catch (error) {
    console.error("Error generating collection metadata:", error);
    return { title: "After Hours Agenda" };
  }
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  let collections: Collection[] = [];
  let products: Product[] = [];

  try {
    collections = await getAllCollections();
  } catch (error) {
    console.error("Error loading collections:", error);
    notFound();
  }

  const collection = collections.find((c) => c.slug === params.slug);
  if (!collection) notFound();

  try {
    products = await getProductsByCollection(collection.id);
  } catch (error) {
    console.error("Error loading collection products:", error);
  }

  const line = getLineForCollection(params.slug);

  return (
    <div className="pt-20 pb-16">
      {/* Station banner */}
      <div
        className="station-banner w-full py-10 px-6 text-center"
        style={{ backgroundColor: line.color }}
      >
        <div className="flex items-center justify-center gap-4 mb-3">
          <RouteBadge slug={params.slug} size="lg" />
          <span className="font-mono text-sm text-white/80 uppercase tracking-[0.2em]">
            Collection
          </span>
        </div>
        <h1 className="font-display font-bold text-hero text-white">
          {collection.name.toUpperCase()}
        </h1>
        {collection.description && (
          <p className="font-body text-white/70 max-w-md mx-auto mt-3">
            {collection.description}
          </p>
        )}
      </div>

      {/* Platform edge stripe */}
      <div className="platform-edge" />

      <div className="max-w-7xl mx-auto px-6 pt-12">
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
