import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/square/catalog";
import { PilotProductGrid } from "@/components/shop/PilotProductGrid";

export const metadata: Metadata = {
  title: "After Hours Agenda",
  description: "After Hours Agenda",
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  const products = await getAllProducts();

  return (
    <div className="px-4 pb-20 pt-28 sm:px-6 lg:pb-28 lg:pt-32">
      <section className="mx-auto max-w-[1280px] border-b border-border/40 pb-12 lg:pb-16">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Working assortment / 01</p>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <h1 className="max-w-[11ch] font-display text-[clamp(3.5rem,9vw,7rem)] font-bold leading-[0.86] tracking-[-0.055em] text-cream">
            After Hours Agenda
          </h1>
          <div className="border-l-2 border-accent pl-5">
            <p className="text-sm leading-relaxed text-muted">Three hoodies are live while the new collection takes shape. Made to order, free shipping, secure Square checkout.</p>
            <Link href="/shop" className="mt-5 inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream underline decoration-accent underline-offset-8 hover:text-accent">View all three</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pilot-heading" className="mx-auto max-w-[1280px] pt-10 lg:pt-14">
        <div className="mb-7 flex items-end justify-between gap-6 border-b border-border/40 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Live now</p>
            <h2 id="pilot-heading" className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em]">The first three</h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-relaxed text-muted md:block">A temporary working set for testing product, bag, checkout, and fulfillment flows.</p>
        </div>
        <PilotProductGrid products={products} headingLevel={3} />
      </section>
    </div>
  );
}
