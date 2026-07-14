import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { CATEGORIES } from "@/lib/commerce/taxonomy";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop All",
  description:
    "Shop the full After Hours Agenda catalog. Men's, women's, and unisex tees, hoodies, sweatshirts, and accessories, printed to order.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getAllProducts();

  return (
    <div className="px-4 pb-16 pt-28 sm:px-6 lg:pt-32">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Shop"
          title="All Products"
          description="The full catalog. Men's, women's, and unisex streetwear, designed in NYC and printed to order."
        />

        <div className="mb-10 grid gap-4 border-y border-border/40 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Free shipping</p>
              <p className="mt-1 text-xs text-muted">On every order. No code needed.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Secure checkout</p>
              <p className="mt-1 text-xs text-muted">Payments processed by Square.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Made to order</p>
              <p className="mt-1 text-xs text-muted">Printed and shipped by Printful.</p>
            </div>
          </div>
        </div>

        <CategoryShopContent products={products} purchasableSizes={getPurchasableSizesMap(products)} colorCounts={getColorCountMap(products)} colorNames={getColorNamesMap(products)} categories={CATEGORIES} basePath="/shop" />
      </div>
    </div>
  );
}
