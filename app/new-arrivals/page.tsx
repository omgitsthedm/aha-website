import { getAllCollections, getAllProducts, getProductsByCollection } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 300;
export const metadata = {
  title: "New Arrivals",
  description: "The latest After Hours Agenda designs, added as they're finished — new graphic tees, hoodies, and accessories, printed to order.",
  alternates: { canonical: "/new-arrivals" },
};

export default async function NewArrivalsPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  let isCuratedList = false;
  try {
    [collections] = await Promise.all([getAllCollections()]);
    const na = collections.find((c) => /new arrivals?/i.test(c.name));
    const curated = na ? await getProductsByCollection(na.id) : [];
    if (curated.length > 0) {
      products = curated;
      isCuratedList = true;
    } else {
      // No curated new-arrivals collection: show the full catalog honestly
      // labeled rather than an empty page.
      products = await getAllProducts();
    }
  } catch (error) {
    console.error("Failed to load new arrivals:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <PageHeader
            title="New arrivals"
            description={
              isCuratedList
                ? "Recently added products from the current After Hours Agenda catalog."
                : "Nothing is flagged as new this week, so here is the full current catalog — every piece printed to order."
            }
          />
        </div>
        <ShopContent products={products} purchasableSizes={getPurchasableSizesMap(products)} colorCounts={getColorCountMap(products)} colorNames={getColorNamesMap(products)} collections={collections} />
      </div>
    </div>
  );
}
