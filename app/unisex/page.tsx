import { getAllProducts } from "@/lib/square/catalog";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  filterProductsByGender,
  getCategorySlugsForGender,
  CATEGORIES,
} from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Unisex Streetwear",
  description:
    "Made for every body. Core unisex tees, hoodies, sweatshirts, and accessories from After Hours Agenda. Made to order in NYC.",
  alternates: { canonical: "/unisex" },
};

export default async function UnisexPage() {
  const allProducts = await getAllProducts();
  const products = filterProductsByGender(allProducts, "unisex");
  const categorySlugs = getCategorySlugsForGender("unisex");
  const categories = CATEGORIES.filter((c) => categorySlugs.includes(c.slug));

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Unisex"
          title="Unisex"
          description="Made for every body. Core pieces sized to share, printed to order, and shipped from NYC."
        />
        <CategoryShopContent
          products={products}
          gender="unisex"
          categories={categories}
          basePath="/unisex"
        />
      </div>
    </div>
  );
}
