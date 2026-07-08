import { getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";
import { getLineForCollection } from "@/lib/utils/subway-lines";

export const revalidate = 300;

// On-demand ISR. No build-time static generation.
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
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div
        className="zine-block zine-cut mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14"
        style={{ boxShadow: `10px 10px 0 ${line.color}` }}
      >
        <div className="flex items-center justify-center gap-4 mb-3">
          <RouteBadge slug={params.slug} size="lg" />
          <span className="font-mono text-sm font-bold text-muted uppercase tracking-[0.12em]">
            Collection
          </span>
        </div>
        <h1 className="misprint font-display text-[clamp(4rem,10vw,9rem)] font-black uppercase leading-[0.8] tracking-[-0.08em] text-cream text-center">
          {collection.name.toUpperCase()}
        </h1>
        {collection.description && (
          <p className="font-body text-muted max-w-xl mx-auto mt-5 text-center font-bold leading-relaxed">
            {collection.description}
          </p>
        )}
      </div>

      <div className="platform-edge mx-auto mt-10 max-w-7xl" />

      <div className="max-w-7xl mx-auto pt-12">
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
