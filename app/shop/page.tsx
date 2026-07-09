import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;

export const metadata = {
  title: "Shop",
  description: "Shop graphic tees, loud color, and made-to-order streetwear from After Hours Agenda.",
};

export default async function ShopPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];

  try {
    [products, collections] = await Promise.all([
      getAllProducts(),
      getAllCollections(),
    ]);
  } catch (error) {
    console.error("Failed to fetch catalog:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="max-w-3xl">
            <div className="mosaic-border" />
            <div className="sign-panel-station">
              <span className="sign-panel-station-text">Shop Everything</span>
            </div>
            <div className="mosaic-border" />
          </div>
          <p className="mt-6 max-w-xl font-body text-base font-bold leading-relaxed text-muted">
            Full catalog, rough edges included. Filter by drop, switch views,
            then pick your size without leaving the page.
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
