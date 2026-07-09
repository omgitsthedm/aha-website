import { getAllProducts, getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = {
  title: "New Arrivals",
  description: "The latest drops and fresh graphics from After Hours Agenda — made to order, shipped free.",
};

export default async function NewArrivalsPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  try {
    [collections] = await Promise.all([getAllCollections()]);
    // Prefer the real "New Arrivals" Square collection; fall back to the full catalog.
    const na = collections.find((c) => /new arrivals?/i.test(c.name));
    products = na ? await getProductsByCollection(na.id) : await getAllProducts();
    if (products.length === 0) products = await getAllProducts();
  } catch (error) {
    console.error("Failed to load new arrivals:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mosaic-border" />
          <div className="sign-panel-station"><span className="sign-panel-station-text">New Arrivals</span></div>
          <div className="mosaic-border" />
          <p className="mt-6 max-w-xl font-body text-base font-bold leading-relaxed text-muted">
            Fresh off the press. Newest graphics first — pick your size and check out without leaving the page.
          </p>
        </div>
        <ShopContent products={products} collections={collections} />
      </div>
    </div>
  );
}
