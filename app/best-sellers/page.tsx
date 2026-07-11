import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;
export const metadata = {
  title: "Catalog Edit",
  description: "An After Hours Agenda catalog edit of active made-to-order graphics.",
  alternates: { canonical: "/best-sellers" },
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
          <PageHeader eyebrow="Selected from the active catalog" title="Catalog edit" description="A starting point for the collection. This is an editorial selection, not an unverified sales ranking." />
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
