import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
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

interface WomenPageProps {
  params: Promise<{ slug?: string[] }>;
}

const GENDER = "women";
const BASE_PATH = "/women";

export async function generateMetadata({ params }: WomenPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  const gender = getGenderBySlug(GENDER)!;

  if (categorySlug && !category) {
    return { title: "Category Not Found | After Hours Agenda" };
  }

  const title = category
    ? `${category.name} for Women`
    : `${gender.name}'s Streetwear`;
  const description = category
    ? `${category.description} Shop made-to-order ${category.name.toLowerCase()} for women.`
    : `${gender.description} Shop women's tees, hoodies, sweatshirts, and accessories.`;

  return {
    title,
    description,
    alternates: { canonical: category ? `${BASE_PATH}/${category.slug}` : BASE_PATH },
  };
}

export default async function WomenPage({ params }: WomenPageProps) {
  const { slug } = await params;
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

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Women"
          title={category ? category.name : "Women's"}
          description={
            category
              ? category.description
              : "Soft-tone sweatshirts, expressive tees, and staples, merchandised for her. Unisex cuts, printed to order."
          }
        />
        {!category && (
          <div className="fold-surface relative mb-10 aspect-[21/9] overflow-hidden md:aspect-[3/1]">
            <Image
              src="/campaign/hero-women-onmodel.webp"
              alt="The Hope and Tomorrow sweatshirt in dusty rose, worn"
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
        />
      </div>
    </div>
  );
}
