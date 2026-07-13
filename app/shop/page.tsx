import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const page = Math.max(1, Number.parseInt((await searchParams).page || "1", 10) || 1);
  const suffix = page > 1 ? ` - Page ${page}` : "";
  return {
    title: `Shop All Graphic Streetwear${suffix}`,
    description: `Shop graphic tees, sweatshirts, accessories, loud color, and made-to-order streetwear from After Hours Agenda${page > 1 ? ` on catalog page ${page}` : ""}, with free standard shipping.`,
    alternates: { canonical: page > 1 ? `/shop?page=${page}` : "/shop" },
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
  const requestedPage = Math.max(1, Number.parseInt((await searchParams).page || "1", 10) || 1);

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-7xl mx-auto">
        <PageHeader title="Shop all products" description="Search by name, filter by collection or size, and open any product for fit, fabric, care, production, shipping, and return details." />
        <ShopContent products={products} collections={collections} initialPage={requestedPage} paginationPath="/shop" />
      </div>
    </div>
  );
}
