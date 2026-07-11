import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;

export const metadata = {
  title: "Shop",
  description: "Shop graphic tees, loud color, and made-to-order streetwear from After Hours Agenda.",
  alternates: { canonical: "/shop" },
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
        <PageHeader eyebrow="Full catalog" title="Shop everything" description="Browse every active product, filter by collection or size, and review the final total before payment." />
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
