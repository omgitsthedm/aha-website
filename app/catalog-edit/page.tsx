import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;
export const metadata = {
  title: "The Catalog Edit",
  description: "Start with the After Hours Agenda catalog edit: an honest editorial route through the active New York graphic apparel index, with live prices and sizes.",
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
          <PageHeader eyebrow="A route into the active archive" title="The catalog edit" description="Start here if one hundred graphics feels like a lot. This is an editorial route through the current design index—not a fabricated sales ranking." />
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
