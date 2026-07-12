import { getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;
export const metadata = {
  title: "New Arrivals",
  description: "Shop new arrivals from After Hours Agenda: the latest active made-to-order graphic apparel from an independent New York streetwear label.",
  alternates: { canonical: "/new-arrivals" },
};

export default async function NewArrivalsPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  try {
    [collections] = await Promise.all([getAllCollections()]);
    const na = collections.find((c) => /new arrivals?/i.test(c.name));
    products = na ? await getProductsByCollection(na.id) : [];
  } catch (error) {
    console.error("Failed to load new arrivals:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <PageHeader eyebrow="Fresh off the press" title="New arrivals" description="The latest pieces to enter the active AHA design index. No fake countdown and no promise that a piece is scarce when it is not." />
        </div>
        {products.length === 0 && <p className="mb-8 border border-border/40 bg-surface p-5 text-sm leading-relaxed text-muted">Nothing new has cleared the press yet. The full design index is still open in Shop.</p>}
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
