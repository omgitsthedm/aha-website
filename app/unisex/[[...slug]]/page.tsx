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
import { notFound } from "next/navigation";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { CatalogMigrationPage, catalogMigrationMetadata } from "@/components/shop/CatalogMigrationPage";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

export const revalidate = 300;

interface UnisexPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}

const GENDER = "unisex";
const BASE_PATH = "/unisex";

export async function generateMetadata({ params }: UnisexPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isStorefrontPublic()) return catalogMigrationMetadata(slug?.length ? `${BASE_PATH}/${slug.join("/")}` : BASE_PATH);
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  const gender = getGenderBySlug(GENDER)!;

  if (categorySlug && !category) {
    return { title: "Category Not Found | After Hours Agenda" };
  }

  const title = category
    ? `Unisex ${category.name}`
    : "Unisex, Made to Order";
  const description = category
    ? `${category.description} Shop made-to-order unisex ${category.name.toLowerCase()}.`
    : "Unisex tees, hoodies, and sweatshirts from After Hours Agenda. One cut, deep size runs, exact measurements listed on every product.";

  // A category we stock nothing in is a real URL with no product on it. Keep it
  // reachable but out of the index rather than letting a placeholder description
  // rank. `getAllProducts` is request-deduped with the page body below.
  const isEmptyCategory = category
    ? filterProductsByCategory(filterProductsByGender(await getAllProducts(), GENDER), category.slug).length === 0
    : false;

  return buildMetadata({
    title,
    description,
    path: category ? `${BASE_PATH}/${category.slug}` : BASE_PATH,
    ...(isEmptyCategory ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function UnisexPage({ params, searchParams }: UnisexPageProps) {
  if (!isStorefrontPublic()) return <CatalogMigrationPage />;
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
        name={category ? `Unisex ${category.name}` : "Unisex"}
        path={listPath}
        products={displayProducts}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Unisex"
          title={category ? category.name : "One cut, worn your way"}
          description={
            category
              ? category.description
              : "Core pieces in unisex sizing, printed to order. One cut, worn your way."
          }
        />
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
