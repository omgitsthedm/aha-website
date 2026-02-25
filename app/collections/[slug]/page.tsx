import { getAllCollections, getProductsByCollection, getAllProducts } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import { notFound } from "next/navigation";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const collections = await getAllCollections();
    return collections.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const collections = await getAllCollections();
  const collection = collections.find((c) => c.slug === params.slug);
  if (!collection) return { title: "Collection Not Found" };
  return {
    title: `${collection.name} | After Hours Agenda`,
    description: collection.description,
  };
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const collections = await getAllCollections();
  const collection = collections.find((c) => c.slug === params.slug);

  if (!collection) notFound();

  const products = await getProductsByCollection(collection.id);

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
