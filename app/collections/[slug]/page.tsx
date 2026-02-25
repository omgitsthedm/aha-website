import { getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";

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
  } catch {
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

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3">
            Collection
          </span>
          <h1 className="font-display font-bold text-hero mb-4">
            {collection.name.toUpperCase()}
          </h1>
          <p className="font-body text-muted max-w-md mx-auto">
            {collection.description}
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
