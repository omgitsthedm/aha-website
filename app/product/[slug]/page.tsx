import { getAllProducts, getProduct } from "@/lib/square/catalog";
import { getProductEnrichment } from "@/lib/data/enrichment";
import { getStockByCatId } from "@/lib/data/stock";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { notFound } from "next/navigation";
import type { Product } from "@/lib/utils/types";
import type { Metadata } from "next";
import { buildProductStory } from "@/lib/content/product-copy";

export const revalidate = 300;

// Pages are generated on-demand and cached via ISR.
// No generateStaticParams. This avoids hammering Square API at build time.
export const dynamicParams = true;

const productMetaTitle = (name: string) => {
  const stem = name.length < 22 ? `${name} Streetwear` : name;
  const shortened = stem.length > 37 ? `${stem.slice(0, 36).trimEnd()}…` : stem;
  return `${shortened} | After Hours Agenda`;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await getProduct(slug);
    if (!product) return { title: "Product Not Found" };

    const enrichment = getProductEnrichment(product.slug);
    const description = buildProductStory(product, enrichment).slice(0, 158);
    const image = product.images[0];
    const title = productMetaTitle(product.name);

    return {
      title: { absolute: title },
      description,
      alternates: { canonical: `/product/${product.slug}` },
      openGraph: {
        title,
        description,
        type: "website",
        ...(image && { images: [{ url: image, alt: product.name }] }),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(image && { images: [image] }),
      },
    };
  } catch (error) {
    console.error("Error generating product metadata:", error);
    return { title: "After Hours Agenda" };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: Product | null = null;
  let products: Product[] = [];

  try {
    [product, products] = await Promise.all([
      getProduct(slug),
      getAllProducts(),
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

  const enrichment = getProductEnrichment(product.slug);
  const storyDescription = buildProductStory(product, enrichment);

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
      <ProductJsonLd product={product} description={storyDescription} />
      <ProductDetail
        product={product}
        related={related}
        enrichment={enrichment}
        stockBySize={stockBySize}
        storyDescription={storyDescription}
      />
    </>
  );
}
