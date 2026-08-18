import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
import { PageHeader } from "@/components/ui/PageHeader";
import { CATEGORIES, getCategoryBySlug, filterProductsByCategory } from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { CatalogMigrationPage, catalogMigrationMetadata } from "@/components/shop/CatalogMigrationPage";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";
import { ORIGIN_CLAIM_SENTENCE, SHIPPING_CLAIM_DETAIL, SHIPPING_CLAIM_SHORT } from "@/lib/commerce/policies";

export const revalidate = 300;
// force-static was correct while every shop path returned the same migration
// screen — it removed a cold start on a page with no data. It is WRONG now the
// capsule is live: the page reads searchParams for pagination and real catalog
// data, and force-static prerendered it into the empty state while the sitemap
// and PDPs advertised six products. revalidate=300 keeps the ISR caching that
// made the mobile LCP budget without freezing the catalog.

interface ShopPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isStorefrontPublic()) return catalogMigrationMetadata(slug?.length ? `/shop/${slug.join("/")}` : "/shop");
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  if (categorySlug && !category) return { title: "Category Not Found | After Hours Agenda" };
  if (category) {
    // A category we stock nothing in is a real URL with no product on it. Keep it
    // reachable but out of the index rather than letting a placeholder description
    // rank. `getAllProducts` is request-deduped with the page body below.
    const isEmpty = filterProductsByCategory(await getAllProducts(), category.slug).length === 0;
    return buildMetadata({
      title: `${category.name}`,
      description: `${category.description} Shop made-to-order ${category.name.toLowerCase()} at After Hours Agenda.`,
      path: `/shop/${category.slug}`,
      ...(isEmpty ? { robots: { index: false, follow: true } } : {}),
    });
  }
  return buildMetadata({
    title: "Shop the Collection — Graphic Tees, Hoods & Crews",
    description: "The After Hours Agenda collection: graphic tees, heavyweight pullover hoods and crewnecks, made to order in 2–5 days for you and the people you love.",
    path: "/shop",
  });
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  if (!isStorefrontPublic()) return <CatalogMigrationPage />;
  const { slug } = await params;
  const { page } = await searchParams;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  if (categorySlug && !category) notFound();

  const products = await getAllProducts();
  const displayProducts = category ? filterProductsByCategory(products, category.slug) : products;
  const listPath = category ? `/shop/${category.slug}` : "/shop";
  const initialPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  return (
    <div className="px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
      <CollectionJsonLd
        name={category ? category.name : "Shop All"}
        path={listPath}
        products={displayProducts}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Shop"
          title={category ? category.name : "The collection"}
          description={category
            ? `${category.description} ${ORIGIN_CLAIM_SENTENCE}`
            : `Graphic tees, heavyweight hoods and crewnecks. One cut, every size, everyone welcome. ${ORIGIN_CLAIM_SENTENCE}`}
        />

        {/* Purchase-surface trust row. Two rules hold here:
            1. The sub-line is `sm:block`, so it is invisible on mobile — the
               label alone has to be true. "Free shipping" was not: CA/GB/AU
               orders carry a real $20 Square service charge
               (lib/commerce/policies.ts). SHIPPING_CLAIM_SHORT is safe alone.
            2. No provider name and no print city. Apliiq prints in Huntington
               Park CA or Philadelphia PA, Printful is legacy-only, and naming
               either one on a shopping page dates the moment fulfillment moves. */}
        <div className="mb-8 grid grid-cols-3 divide-x divide-border/40 border-y border-border/40 py-4">
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">{SHIPPING_CLAIM_SHORT}</p><p className="mt-1 hidden text-xs text-muted sm:block">{SHIPPING_CLAIM_DETAIL}. No code needed.</p></div>
          </div>
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">Secure checkout</p><p className="mt-1 hidden text-xs text-muted sm:block">Payments processed by Square.</p></div>
          </div>
          <div className="flex items-start gap-2 px-2 sm:gap-3 sm:px-4">
            <span className="mt-0.5 hidden h-2 w-2 shrink-0 bg-accent sm:block" aria-hidden="true" />
            <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cream sm:text-xs sm:tracking-[0.08em]">Made to order</p><p className="mt-1 hidden text-xs text-muted sm:block">Nothing is printed until you order it.</p></div>
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
          initialPage={initialPage}
          paginationPath={listPath}
        />
      </div>
    </div>
  );
}
