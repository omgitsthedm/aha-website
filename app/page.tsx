import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";
import { PilotProductGrid } from "@/components/shop/PilotProductGrid";

export const metadata: Metadata = {
  title: "After Hours Agenda | NYC Streetwear",
  description:
    "NYC streetwear made to order. Hoodies, tees, and pieces built for the second shift. Free shipping. Secure Square checkout.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const products = await getAllProducts();

  return (
    <div className="px-4 pb-20 pt-28 sm:px-6 lg:pb-28 lg:pt-32">
      <section className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="hero-copy-enter max-w-2xl">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Working assortment / 01</p>
            <h1 className="mt-5 font-display text-[clamp(3.5rem,10vw,7rem)] font-bold leading-[0.86] tracking-[-0.055em] text-cream">
              After Hours <span className="text-accent">Agenda</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted md:text-lg">
              NYC streetwear made to order. A small live set of hoodies while the next collection takes shape.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 hero-actions-enter">
              <Link href="/shop" className="primary-action min-h-12 px-7 text-xs">Shop the three</Link>
              <Link href="/about" className="secondary-action min-h-12 px-7 text-xs">Read the agenda</Link>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-3 text-xs font-bold uppercase tracking-[0.05em] text-muted sm:grid-cols-4 hero-support-enter">
              <li className="flex items-center gap-2 border-l-2 border-accent pl-3">Free shipping</li>
              <li className="flex items-center gap-2 border-l-2 border-accent pl-3">Made to order</li>
              <li className="flex items-center gap-2 border-l-2 border-accent pl-3">Square checkout</li>
              <li className="flex items-center gap-2 border-l-2 border-accent pl-3">30-day returns</li>
            </ul>
          </div>

          <div className="hero-visual-enter relative">
            <div className="fold-surface relative aspect-[4/5] overflow-hidden">
              <Image
                src="/printful-assets/Branded_Unisex_Hoodie.png"
                alt="Branded Unisex Hoodie by After Hours Agenda"
                fill
                priority
                className="product-art object-contain p-6 sm:p-10"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="pilot-heading" className="mx-auto mt-20 max-w-[1280px] border-t border-border/40 pt-12 lg:mt-28 lg:pt-16">
        <div className="mb-7 flex items-end justify-between gap-6 border-b border-border/40 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Live now</p>
            <h2 id="pilot-heading" className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em]">The first three</h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-relaxed text-muted md:block">A temporary working set for testing product, bag, checkout, and fulfillment flows.</p>
        </div>
        <PilotProductGrid products={products} headingLevel={3} />
      </section>

      <section aria-labelledby="manifesto-heading" className="mx-auto mt-20 max-w-[1280px] lg:mt-28">
        <div className="fold-surface p-6 sm:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The agenda</p>
              <h2 id="manifesto-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em] text-cream">Built for the second shift</h2>
            </div>
            <div className="space-y-5 text-sm leading-relaxed text-muted md:text-base">
              <p>After Hours Agenda is an independent NYC label for people who keep working after the day job ends. Every piece is made to order and printed on demand, which means less waste and no unsold stock sitting in a warehouse.</p>
              <p>The first three hoodies are live to prove the storefront, checkout, and fulfillment pipeline. More drops are coming. Sign up for the Dispatch to get restock alerts and first notice when the next release is ready.</p>
              <Link href="/newsletter" className="inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-accent underline underline-offset-8 hover:text-cream">Join the Dispatch</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
