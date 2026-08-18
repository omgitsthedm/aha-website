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
  type CategorySlug,
} from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { CatalogMigrationPage, catalogMigrationMetadata } from "@/components/shop/CatalogMigrationPage";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

export const revalidate = 300;

interface WomenPageProps {
  params: Promise<{ slug?: string[] }>;
}

const GENDER = "women";
const BASE_PATH = "/women";

// Hand-written per category. The old `${category.description} Shop made-to-order
// ${name} for women.` template produced 87-100 character descriptions — half the
// 150-160 a result snippet can carry — and concatenated "Coming soon." into a
// contradiction on outerwear. Every claim here is on the page already: fabrics
// from the product manifest, unisex fit from the size guide, print-on-order.
// WARNING on `outerwear`: the noindex below is derived from live stock, so the
// route re-enters the index by itself the day a jacket ships — this string does
// not. Rewrite the outerwear entry in the same commit that stocks the category.
const CATEGORY_DESCRIPTIONS: Record<CategorySlug, string> = {
  "t-shirts":
    "Women's graphic tees, shirts, and statement prints in ringspun cotton — unisex cuts, made to order. Size guide on every page.",
  "hoodies-sweatshirts":
    "Women's hoodies and heavyweight sweatshirts in cotton-poly fleece — unisex cuts, made to order. Size guide on every page.",
  "sweaters-knitwear":
    "Women's crewnecks, cardigans, and knitted pieces in cotton-blend knit — unisex cuts, made to order. Full measurements on every page.",
  accessories:
    "Hats, totes, socks, pins, and stickers in the women's edit from After Hours Agenda — small pieces that finish the fit, made to order and made to order.",
  outerwear:
    "Jackets and coats are not in the After Hours Agenda catalog yet. Browse the hoodies, sweatshirts, and knitwear After Hours Agenda prints to order.",
};

export async function generateMetadata({ params }: WomenPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isStorefrontPublic()) return catalogMigrationMetadata(slug?.length ? `${BASE_PATH}/${slug.join("/")}` : BASE_PATH);
  const categorySlug = slug?.[0];
  const category = categorySlug ? getCategoryBySlug(categorySlug) : undefined;
  const gender = getGenderBySlug(GENDER)!;

  if (categorySlug && !category) {
    return { title: "Category Not Found | After Hours Agenda" };
  }

  const title = category
    ? `${category.name} for Women`
    : "Women's Graphic Tees & Hoodies";
  const description = category
    ? CATEGORY_DESCRIPTIONS[category.slug]
    : "Women's graphic tees, hoodies, sweatshirts, and knitwear in unisex cuts — made to order. Exact measurements on every page.";

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

export default async function WomenPage({ params }: WomenPageProps) {
  if (!isStorefrontPublic()) return <CatalogMigrationPage />;
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
  const listPath = category ? `${BASE_PATH}/${category.slug}` : BASE_PATH;

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <CollectionJsonLd
        name={category ? `${category.name} for Women` : "Women's"}
        path={listPath}
        products={displayProducts}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Women"
          title={category ? category.name : "Women's tees, hoodies & knitwear"}
          description={
            category
              ? category.description
              // "Merchandised for her" niched the wearer and "soft-tone" gendered
              // the line by softness — both ruled out by the manifesto and
              // CLAUDE.md. Names what is on the page, the way /accessories does.
              : "Black Sheep sweatshirts, cotton-blend knits, and ringspun cotton graphic tees. One unisex cut, true to size, printed when you order."
          }
        />
        <CategoryShopContent
          products={displayProducts} purchasableSizes={getPurchasableSizesMap(displayProducts)} colorCounts={getColorCountMap(displayProducts)} colorNames={getColorNamesMap(displayProducts)}
          gender={GENDER}
          activeCategory={category?.slug}
          categories={categoryOptions}
          basePath={BASE_PATH}
          paginationPath={listPath}
        />
      </div>
    </div>
  );
}
