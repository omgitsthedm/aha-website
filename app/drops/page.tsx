import Link from "next/link";
import { getAllProducts, getAllCollections, getProductsByCollection } from "@/lib/square/catalog";
import { ShopContent } from "@/components/shop/ShopContent";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = {
  title: "Drops | After Hours Agenda",
  description: "The current After Hours Agenda drop — limited graphics, made to order, shipped free.",
};

export default async function DropsPage() {
  let products: Product[] = [];
  let collections: Collection[] = [];
  try {
    collections = await getAllCollections();
    const na = collections.find((c) => /new arrivals?/i.test(c.name));
    products = na ? await getProductsByCollection(na.id) : await getAllProducts();
    if (products.length === 0) products = await getAllProducts();
  } catch (error) {
    console.error("Failed to load drops:", error);
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        {/* Drop hero */}
        <div className="zine-block relative mb-12 overflow-hidden p-6 md:p-10">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-[#CCFF00]">Now dropping</p>
          <h1 className="misprint mt-3 font-display text-[clamp(3rem,9vw,7rem)] font-black uppercase leading-[0.8] tracking-[-0.06em] text-cream">
            The Drop
          </h1>
          <p className="mt-5 max-w-2xl font-body text-base font-bold leading-relaxed text-muted md:text-lg">
            Everything currently in rotation. Made to order the moment you buy — no dead stock, no landfill.
            When a graphic&apos;s gone, it&apos;s gone. No fake timers, just the truth: shop it while it&apos;s here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/shop" className="metrocard-gradient px-6 py-4 font-body text-sm font-bold uppercase tracking-[0.08em]">Shop everything</Link>
            <Link href="#drop-grid" className="inline-flex items-center border-[3px] border-[#E9E1D4] px-6 py-4 font-body text-sm font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:bg-[#E9E1D4] hover:text-[#10100F]">
              See the pieces
            </Link>
          </div>
        </div>

        <div id="drop-grid">
          <ShopContent products={products} collections={collections} />
        </div>

        {/* Signup band */}
        <div className="zine-paper mt-14 px-6 py-8 text-center">
          <h2 className="font-display text-3xl font-black uppercase tracking-[-0.04em] text-[#10100F]">Get the next drop first</h2>
          <p className="mx-auto mt-2 max-w-md font-body text-sm font-bold text-[#10100F]">
            Join the agenda for drop alerts and restocks. No spam — just drops, restocks, and the occasional bad idea.
          </p>
          <Link href="/contact" className="mt-5 inline-block bg-[#10100F] px-6 py-4 font-body text-sm font-bold uppercase tracking-[0.08em] text-cream">
            Join the list
          </Link>
        </div>
      </div>
    </div>
  );
}
