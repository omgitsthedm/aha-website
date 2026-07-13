import { getAllProducts } from "@/lib/square/catalog";
import { getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  filterProductsByGender,
  getCategorySlugsForGender,
  CATEGORIES,
} from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";
import Image from "next/image";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Unisex Streetwear",
  description:
    "Core unisex tees, hoodies, sweatshirts, and accessories from After Hours Agenda. Every piece printed to order.",
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
          description="Core pieces in unisex sizing, printed to order. One cut, worn your way."
        />
        <div className="fold-surface relative mb-10 aspect-[21/9] overflow-hidden md:aspect-[3/1]">
          <Image
            src="/campaign/hero-unisex.jpg"
            alt="No Place Like New York sweatshirt and EMO But In Heels hoodie on a paper background"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
        </div>
        <CategoryShopContent
          products={products} purchasableSizes={getPurchasableSizesMap(products)}
          gender="unisex"
          categories={categories}
          basePath="/unisex"
        />
      </div>
    </div>
  );
}
