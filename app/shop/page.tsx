import { getAllProducts } from "@/lib/square/catalog";
import { PilotProductGrid } from "@/components/shop/PilotProductGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Three Hoodies",
  description: "Three After Hours Agenda hoodies, live while the new collection is built.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getAllProducts();

  return (
    <div className="px-4 pb-20 pt-28 sm:px-6 lg:pt-32">
      <div className="mx-auto max-w-[1280px]">
        <PageHeader eyebrow="Working assortment / 01" title="Three hoodies" description="A small live set for testing the complete storefront while the new collection is built. Made to order, free shipping, and fulfilled through Printful after verified Square payment." />
        <PilotProductGrid products={products} />
      </div>
    </div>
  );
}
