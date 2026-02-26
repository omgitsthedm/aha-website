import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;

export const metadata = {
  title: "Shop | After Hours Agenda",
  description: "Shop the full After Hours Agenda collection. Premium streetwear, made to order in NYC.",
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
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="max-w-md mx-auto">
            <div className="mosaic-border" />
            <div className="sign-panel-station justify-center">
              <span className="sign-panel-station-text text-lg md:text-xl tracking-[0.25em]">Shop</span>
            </div>
            <div className="mosaic-border" />
          </div>
          <p className="font-body text-muted text-center max-w-md mx-auto mt-6">
            The full collection. Made to order, made to last.
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
