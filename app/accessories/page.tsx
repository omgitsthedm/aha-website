import { getAllProducts } from "@/lib/square/catalog";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { filterProductsByCategory, CATEGORIES } from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Accessories | After Hours Agenda",
  description:
    "Hats, beanies, bags, stickers, pins, and finishing pieces from After Hours Agenda. Made to order in NYC.",
  alternates: { canonical: "/accessories" },
};

export default async function AccessoriesPage() {
  const allProducts = await getAllProducts();
  const products = filterProductsByCategory(allProducts, "accessories");

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Accessories"
          title="Accessories"
          description="Hats, bags, stickers, pins, and the small details that finish the fit. Every piece made to order."
        />
        <CategoryShopContent
          products={products}
          activeCategory="accessories"
          categories={CATEGORIES}
          basePath="/accessories"
        />
      </div>
    </div>
  );
}
