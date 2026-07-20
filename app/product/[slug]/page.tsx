import { getAllProducts, getProduct } from "@/lib/square/catalog";
import { getProductEnrichment } from "@/lib/data/enrichment";
import { getStockByCatId } from "@/lib/data/stock";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { notFound } from "next/navigation";
import type { Product } from "@/lib/utils/types";
import type { Metadata } from "next";
import { buildProductStory, isAuthoredSquareDescription } from "@/lib/content/product-copy";
import { loadProducts } from "@/lib/data/products";
import { getProductReviews } from "@/lib/commerce/reviews";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";

export const revalidate = 300;
// dynamicParams=false: only slugs present in generateStaticParams (every product
// in the local manifest) are valid. Any other slug — a deleted or never-existent
// product — returns a real HTTP 404 (Next's not-found) instead of the ISR
// soft-404 (a "Product Not Found" page served with a 200) that Netlify produced
// when notFound() ran inside an on-demand render. The manifest is the storefront
// source of truth and every new product ships with a redeploy, so no real product
// is ever missing from generateStaticParams.
export const dynamicParams = false;

// Prebuild every known PDP from the LOCAL manifest (no Square calls at build) so
// product pages are served from the ISR cache instead of a cold on-demand render
// (which re-paginated the whole Square catalog — the ~1.8s TTFB). Prices still
// refresh every 300s via `revalidate`, and the charge is re-priced live, so this
// changes nothing about how orders are priced.
export function generateStaticParams() {
  try {
    return loadProducts().map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

const TITLE_SUFFIX = " | After Hours Agenda";

// Truncate at a word boundary (never mid-word) and add an ellipsis only when we
// actually cut. `max` is the visible character budget.
const truncateAtWord = (value: string, max: number) => {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const productMetaTitle = (name: string) => {
  const stem = name.length < 22 ? `${name} Streetwear` : name;
  // Prefer the full product name (keyword-complete). Only truncate — at a word
  // boundary — when "<name> | After Hours Agenda" would exceed ~60 chars.
  const budget = 60 - TITLE_SUFFIX.length;
  return `${truncateAtWord(stem, budget)}${TITLE_SUFFIX}`;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await getProduct(slug);
    if (!product) return { title: "Product Not Found" };

    const enrichment = getProductEnrichment(product.slug);
    const rawDescription = isAuthoredSquareDescription(product.description)
      ? product.description!.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : buildProductStory(product, enrichment);
    const description = truncateAtWord(rawDescription, 155);
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

  // Enrichment is synchronous local-manifest data keyed by slug — start the live
  // Printful stock fetch in parallel with the Square catalog fetch instead of
  // waterfalling after it (removes one serial network hop from PDP TTFB).
  const enrichment = getProductEnrichment(slug);
  const stockPromise = enrichment
    ? getStockByCatId(Object.values(enrichment.catIdBySize)).catch(() => ({} as Record<number, boolean>))
    : Promise.resolve({} as Record<number, boolean>);
  const reviewsPromise = getProductReviews(slug);

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

  // Prefer the human-authored Square description (the brand's actual copy) and
  // only fall back to the generated story when Square has nothing real. This
  // surfaces the per-product storytelling that was previously suppressed.
  const reviews = await reviewsPromise;
  const storyDescription = isAuthoredSquareDescription(product.description)
    ? product.description!
    : buildProductStory(product, enrichment);
  // JSON-LD needs plain text, not the authored HTML markup.
  const plainDescription = storyDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Live Printful stock per size (5-min fresh; fails open to in-stock).
  const stockBySize: Record<string, boolean> = {};
  if (enrichment) {
    const stock = await stockPromise;
    for (const [size, catId] of Object.entries(enrichment.catIdBySize)) {
      stockBySize[size] = stock[catId] ?? true;
    }
  }

  // Map each sold color to the gallery image showing that colorway, matched
  // by the color slug embedded in the local mockup filename.
  const colorImageIndex: Record<string, number> = {};
  if (enrichment) {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const claimed = new Set<number>();
    // Longest color names first so "True Navy" claims its image before "Navy".
    const colorsByLength = [...enrichment.colors].sort((a, b) => b.length - a.length);
    for (const color of colorsByLength) {
      const needle = normalize(color);
      if (!needle) continue;
      const index = product.images.findIndex(
        (image, i) => !claimed.has(i) && image.startsWith("/products/") && normalize(image).includes(needle)
      );
      if (index >= 0) {
        colorImageIndex[color] = index;
        claimed.add(index);
      }
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${siteUrl}/shop` },
      { "@type": "ListItem", position: 3, name: product.name, item: `${siteUrl}/product/${product.slug}` },
    ],
  };

  return (
    <>
      <ProductJsonLd product={product} description={plainDescription} reviews={reviews} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail
        product={product}
        related={related}
        enrichment={enrichment}
        stockBySize={stockBySize}
        storyDescription={storyDescription}
        colorImageIndex={colorImageIndex}
        reviews={reviews}
        squareConfig={getSquareWebPaymentsConfig()}
      />
    </>
  );
}
