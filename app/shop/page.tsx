import { getAllProducts } from "@/lib/square/catalog";
import { PilotProductGrid } from "@/components/shop/PilotProductGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop",
  description: "Three After Hours Agenda hoodies, live while the new collection is built. Made to order, free shipping, and fulfilled through Printful after verified Square payment.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getAllProducts();

  return (
    <div className="px-4 pb-20 pt-28 sm:px-6 lg:pt-32">
      <div className="mx-auto max-w-[1280px]">
        <PageHeader
          eyebrow="Working assortment / 01"
          title="Three hoodies"
          description="A small live set for testing the complete storefront while the new collection is built. Made to order, free shipping, and fulfilled through Printful after verified Square payment."
        />

        <div className="mb-10 grid gap-4 border-y border-border/40 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Free shipping</p>
              <p className="mt-1 text-xs text-muted">On every order. No code needed.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Secure checkout</p>
              <p className="mt-1 text-xs text-muted">Payments processed by Square.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 block h-2 w-2 bg-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cream">Made to order</p>
              <p className="mt-1 text-xs text-muted">Printed and shipped by Printful.</p>
            </div>
          </div>
        </div>

        <PilotProductGrid products={products} />
      </div>
    </div>
  );
}
