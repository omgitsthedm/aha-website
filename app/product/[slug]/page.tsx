import { getAllProducts, getProduct, getAllCollections } from "@/lib/square/catalog";
import { getProductEnrichment } from "@/lib/data/enrichment";
import { getStockByCatId } from "@/lib/data/stock";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { notFound } from "next/navigation";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;

// Pages are generated on-demand and cached via ISR.
// No generateStaticParams — avoids hammering Square API at build time.
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const product = await getProduct(params.slug);
    if (!product) return { title: "Product Not Found" };

    const description =
      product.description?.replace(/<[^>]*>/g, "").slice(0, 160) ||
      `Shop ${product.name} from After Hours Agenda`;
    const image = product.images[0];

    return {
      title: product.name,
      description,
      openGraph: {
        title: `${product.name} | After Hours Agenda`,
        description,
        type: "website",
        ...(image && { images: [{ url: image, alt: product.name }] }),
      },
      twitter: {
        card: "summary_large_image",
        title: product.name,
        description,
        ...(image && { images: [image] }),
      },
    };
  } catch (error) {
    console.error("Error generating product metadata:", error);
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

  const enrichment = getProductEnrichment(product.slug);

  // Live Printful stock per size (5-min fresh; fails open to in-stock).
  const stockBySize: Record<string, boolean> = {};
  if (enrichment) {
    const stock = await getStockByCatId(Object.values(enrichment.catIdBySize));
    for (const [size, catId] of Object.entries(enrichment.catIdBySize)) {
      stockBySize[size] = stock[catId] ?? true;
    }
  }

  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetail
        product={product}
        related={related}
        collection={collection}
        enrichment={enrichment}
        stockBySize={stockBySize}
      />
    </>
  );
}
