import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;
export const metadata = {
  title: "Featured Products",
  description: "Browse featured products from After Hours Agenda with current prices and available sizes.",
  alternates: { canonical: "/catalog-edit" },
};

export default async function CatalogEditPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  try {
    [products, collections] = await Promise.all([getAllProducts(), getAllCollections()]);
  } catch (error) {
    console.error("Failed to load catalog edit:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <PageHeader title="Featured products" description="A smaller selection from the current catalog. This is an editorial selection, not a sales ranking." />
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
