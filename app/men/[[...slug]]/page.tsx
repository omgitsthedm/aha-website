import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getCategoryBySlug,
  getGenderBySlug,
  getCategorySlugsForGender,
  filterProductsByGender,
  filterProductsByCategory,
  CATEGORIES,
} from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

export const revalidate = 300;

interface MenPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}

const GENDER = "men";
const BASE_PATH = "/men";

export async function generateMetadata({ params }: MenPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  const gender = getGenderBySlug(GENDER)!;

  if (categorySlug && !category) {
    return { title: "Category Not Found | After Hours Agenda" };
  }

  const title = category
    ? `${category.name} for Men`
    : "Men's Graphic Tees & Hoodies NYC";
  const description = category
    ? `${category.description} Shop made-to-order ${category.name.toLowerCase()} for men.`
    : "Men's graphic tees, hoodies, sweatshirts, and knitwear in unisex cuts — designed in NYC, printed when you order. Size guide on every product page.";

  // A category we stock nothing in is a real URL with no product on it. Keep it
  // reachable but out of the index rather than letting a placeholder description
  // rank. `getAllProducts` is request-deduped with the page body below.
  const isEmptyCategory = category
    ? filterProductsByCategory(filterProductsByGender(await getAllProducts(), GENDER), category.slug).length === 0
    : false;

  return {
    title,
    description,
    alternates: { canonical: category ? `${BASE_PATH}/${category.slug}` : BASE_PATH },
    ...(isEmptyCategory ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function MenPage({ params, searchParams }: MenPageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;

  if (categorySlug && !category) {
    notFound();
  }

  const allProducts = await getAllProducts();
  const genderProducts = filterProductsByGender(allProducts, GENDER);
  const displayProducts = category
    ? filterProductsByCategory(genderProducts, category.slug)
    : genderProducts;

  const categorySlugs = getCategorySlugsForGender(GENDER);
  const categoryOptions = CATEGORIES.filter((c) => categorySlugs.includes(c.slug));
  const listPath = category ? `${BASE_PATH}/${category.slug}` : BASE_PATH;
  const initialPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <CollectionJsonLd
        name={category ? `${category.name} for Men` : "Men's"}
        path={listPath}
        products={displayProducts}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Men"
          title={category ? category.name : "Men's tees, hoodies & knitwear"}
          description={
            category
              ? category.description
              : "Heavyweight hoodies, statement tees, and everyday staples, merchandised for him. Unisex cuts, printed to order."
          }
        />
        {!category && (
          <div className="fold-surface relative mb-6 aspect-[3/1] overflow-hidden md:mb-10">
            <Image
              src="/campaign/hero-men-onmodel.webp"
              alt="The Classic AHA hoodie in black, worn"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1280px) 100vw, 1280px"
            />
          </div>
        )}
        <CategoryShopContent
          products={displayProducts} purchasableSizes={getPurchasableSizesMap(displayProducts)} colorCounts={getColorCountMap(displayProducts)} colorNames={getColorNamesMap(displayProducts)}
          gender={GENDER}
          activeCategory={category?.slug}
          categories={categoryOptions}
          basePath={BASE_PATH}
          initialPage={initialPage}
          paginationPath={listPath}
        />
      </div>
    </div>
  );
}
