import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";

export const metadata: Metadata = {
  title: "After Hours Agenda | NYC Streetwear",
  description:
    "NYC streetwear made to order. Men's, women's, and unisex tees, hoodies, sweatshirts, and accessories. Free shipping. Secure Square checkout.",
  alternates: { canonical: "/" },
};

const categoryTiles = [
  { label: "Men", href: "/men", image: "/printful-assets/Classic_-_Black_Unisex_Hoodie.png" },
  { label: "Women", href: "/women", image: "/printful-assets/Colors_Unisex_Hoodie.png" },
  { label: "Unisex", href: "/unisex", image: "/printful-assets/Branded_Unisex_Hoodie.png" },
  { label: "Accessories", href: "/accessories", image: "/printful-assets/AHA_Cuffed_Beanie.png" },
];

export default async function HomePage() {
  const products = await getAllProducts();
  const featured = products
    .slice()
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 8);

  return (
    <div className="px-4 pb-20 pt-28 sm:px-6 lg:pb-28 lg:pt-32">
      <section className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="hero-copy-enter max-w-2xl">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">NYC Streetwear</p>
            <h1 className="mt-5 font-display text-[clamp(3.5rem,10vw,7rem)] font-bold leading-[0.86] tracking-[-0.055em] text-cream">
              After Hours <span className="text-accent">Agenda</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted md:text-lg">
              Made-to-order streetwear for the second shift. Tees, hoodies, sweatshirts, and accessories for men, women, and every body.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 hero-actions-enter">
              <Link href="/men" className="primary-action min-h-12 px-7 text-xs">Shop Men</Link>
              <Link href="/women" className="primary-action min-h-12 px-7 text-xs">Shop Women</Link>
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
                alt="After Hours Agenda Branded Unisex Hoodie"
                fill
                priority
                className="product-art object-contain p-6 sm:p-10"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-heading" className="mx-auto mt-20 max-w-[1280px] border-t border-border/40 pt-12 lg:mt-28 lg:pt-16">
        <div className="mb-7 border-b border-border/40 pb-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Shop by category</p>
          <h2 id="categories-heading" className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em]">The collection</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {categoryTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group relative aspect-[3/4] overflow-hidden border-b border-border/40 bg-surface transition-colors hover:border-accent"
            >
              <Image
                src={tile.image}
                alt={`${tile.label} category`}
                fill
                className="object-contain p-4 transition-transform duration-500 group-hover:scale-105 product-art"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/90 to-transparent p-4 pt-12">
                <p className="font-display text-xl font-bold uppercase tracking-[-0.02em] text-cream">{tile.label}</p>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent opacity-0 transition-opacity group-hover:opacity-100">Shop now →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="mx-auto mt-20 max-w-[1280px] border-t border-border/40 pt-12 lg:mt-28 lg:pt-16">
        <div className="mb-7 flex items-end justify-between gap-6 border-b border-border/40 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Featured</p>
            <h2 id="featured-heading" className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em]">Right now</h2>
          </div>
          <Link href="/unisex" className="hidden font-mono text-xs font-bold uppercase tracking-[0.06em] text-accent underline underline-offset-4 hover:text-cream md:block">Shop everything</Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">
            {featured.map((product, index) => (
              <Link key={product.id} href={`/product/${product.slug}`} className="group block focus-visible:outline-offset-4">
                <div className="relative aspect-[3/4] overflow-hidden border-b border-border/40 bg-surface transition-colors group-hover:border-accent">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    priority={index < 4}
                    className="object-contain p-3 product-art"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <div className="border-b border-border/40 py-3 transition-colors group-hover:border-accent">
                  <h3 className="line-clamp-2 font-display text-base font-bold uppercase leading-[0.95] tracking-[-0.025em] text-cream group-hover:text-accent">{product.name}</h3>
                  <p className="mt-2 font-mono text-xs font-bold text-cream">{product.priceFormatted}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Check back soon for new drops.</p>
        )}
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
              <p>Browse the full catalog by category, or sign up for the Dispatch to get first notice on restocks and the next release.</p>
              <Link href="/newsletter" className="inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-accent underline underline-offset-8 hover:text-cream">Join the Dispatch</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
