import { getAllProducts, getProduct, getAllCollections } from "@/lib/square/catalog";
import { ProductDetail } from "@/components/product/ProductDetail";
import { notFound } from "next/navigation";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const products = await getAllProducts();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: `${product.name} | After Hours Agenda`,
    description: product.description?.replace(/<[^>]*>/g, "").slice(0, 160) || `Shop ${product.name} from After Hours Agenda`,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [product, products, collections] = await Promise.all([
    getProduct(params.slug),
    getAllProducts(),
    getAllCollections(),
  ]);

  if (!product) notFound();

  // Find related products (same collection)
  const related = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.collectionIds.some((id) => product.collectionIds.includes(id))
    )
    .slice(0, 4);

  // Find collection info for accent color
  const collection = collections.find((c) =>
    product.collectionIds.includes(c.id)
  );

  return <ProductDetail product={product} related={related} collection={collection} />;
}
