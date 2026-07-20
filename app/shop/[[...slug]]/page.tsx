import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
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
        title: "Shop All Graphic Tees, Hoodies & More",
        description: "Every After Hours Agenda design in one place — graphic tees, hoodies, sweatshirts, knitwear, and accessories, each printed to order in 2–5 days.",
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
    <div className="px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
      <CollectionJsonLd
        name={category ? category.name : "Shop All"}
        path={category ? `/shop/${category.slug}` : "/shop"}
        products={displayProducts}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Shop"
          title={category ? category.name : "The whole catalog, printed to order"}
          description={category
            ? `${category.description} Designed in NYC and printed to order.`
            : "Every design in one place — graphic tees, hoodies, sweatshirts, knitwear, and accessories. Graphic-led, unisex cuts, designed in New York."}
        />

        <div className="mb-8 grid grid-cols-3 divide-x divide-border/40 border-y border-border/40 py-4">
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">Free shipping</p><p className="mt-1 hidden text-xs text-muted sm:block">On every order. No code needed.</p></div>
          </div>
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">Secure checkout</p><p className="mt-1 hidden text-xs text-muted sm:block">Payments processed by Square.</p></div>
          </div>
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">Made to order</p><p className="mt-1 hidden text-xs text-muted sm:block">Printed and shipped by Printful.</p></div>
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
