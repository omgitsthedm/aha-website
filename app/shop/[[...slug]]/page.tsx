import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { CATEGORIES, getCategoryBySlug, filterProductsByCategory } from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 300;

interface ShopPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  if (categorySlug && !category) return { title: "Category Not Found | After Hours Agenda" };
  return category
    ? {
        title: `${category.name}`,
        description: `${category.description} Shop made-to-order ${category.name.toLowerCase()} at After Hours Agenda.`,
        alternates: { canonical: `/shop/${category.slug}` },
      }
    : {
        title: "Shop All",
        description: "Shop the full After Hours Agenda catalog. Men's, women's, and unisex tees, hoodies, sweatshirts, and accessories, printed to order.",
        alternates: { canonical: "/shop" },
      };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { slug } = await params;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  if (categorySlug && !category) notFound();

  const products = await getAllProducts();
  const displayProducts = category ? filterProductsByCategory(products, category.slug) : products;

  return (
    <div className="px-4 pb-16 pt-28 sm:px-6 lg:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Shop"
          title={category ? category.name : "All Products"}
          description={category
            ? `${category.description} Designed in NYC and printed to order.`
            : "The full catalog. Men's, women's, and unisex streetwear, designed in NYC and printed to order."}
        />

        <div className="mb-10 grid gap-4 border-y border-border/40 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div><p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Free shipping</p><p className="mt-1 text-xs text-muted">On every order. No code needed.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div><p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Secure checkout</p><p className="mt-1 text-xs text-muted">Payments processed by Square.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div><p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Made to order</p><p className="mt-1 text-xs text-muted">Printed and shipped by Printful.</p></div>
          </div>
        </div>

        <CategoryShopContent
          products={displayProducts}
          purchasableSizes={getPurchasableSizesMap(displayProducts)}
          colorCounts={getColorCountMap(displayProducts)}
          colorNames={getColorNamesMap(displayProducts)}
          categories={CATEGORIES}
          activeCategory={category?.slug}
          basePath="/shop"
        />
      </div>
    </div>
  );
}
