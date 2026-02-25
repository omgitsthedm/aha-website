import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;

export const metadata = {
  title: "Shop | After Hours Agenda",
  description: "Browse the full After Hours Agenda collection. NYC-born streetwear for those who write their own rules.",
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
          <h1 className="font-display font-bold text-hero text-center mb-4">
            SHOP
          </h1>
          <p className="font-body text-muted text-center max-w-md mx-auto">
            Every piece tells a story. Find yours.
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
