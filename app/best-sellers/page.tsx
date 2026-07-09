import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = {
  title: "Best Sellers",
  description: "The After Hours Agenda lineup people keep coming back to — core graphics, made to order.",
};

export default async function BestSellersPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  try {
    [products, collections] = await Promise.all([getAllProducts(), getAllCollections()]);
  } catch (error) {
    console.error("Failed to load best sellers:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mosaic-border" />
          <div className="sign-panel-station"><span className="sign-panel-station-text">Best Sellers</span></div>
          <div className="mosaic-border" />
          <p className="mt-6 max-w-xl font-body text-base font-bold leading-relaxed text-muted">
            The core lineup — the pieces that define the label. Filter by collection, sort your way, add to bag.
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
