import { getAllProducts, getProduct, getAllCollections } from "@/lib/square/catalog";
import { ProductDetail } from "@/components/product/ProductDetail";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;

// Pages are generated on-demand and cached via ISR.
// No generateStaticParams — avoids hammering Square API at build time.
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const product = await getProduct(params.slug);
    if (!product) return { title: "Product Not Found | After Hours Agenda" };
    return {
      title: `${product.name} | After Hours Agenda`,
      description: product.description?.replace(/<[^>]*>/g, "").slice(0, 160) || `Shop ${product.name} from After Hours Agenda`,
    };
  } catch {
    return { title: "After Hours Agenda" };
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let product: Product | null = null;
  let products: Product[] = [];
  let collections: Collection[] = [];

  try {
    [product, products, collections] = await Promise.all([
      getProduct(params.slug),
      getAllProducts(),
      getAllCollections(),
    ]);
  } catch (error) {
    console.error("Error loading product:", error);
    notFound();
  }

  if (!product) notFound();

  // Find related products (same collection)
  const related = products
    .filter(
      (p) =>
        p.id !== product!.id &&
        p.collectionIds.some((id) => product!.collectionIds.includes(id))
    )
    .slice(0, 4);

  // Find collection info for accent color
  const collection = collections.find((c) =>
    product!.collectionIds.includes(c.id)
  );

  return <ProductDetail product={product} related={related} collection={collection} />;
}
