import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";
import { TrustStrip } from "@/components/ui/TrustStrip";

export const metadata: Metadata = {
  title: "After Hours Agenda | NYC Streetwear",
  description:
    "NYC streetwear made to order. Men's, women's, and unisex tees, hoodies, sweatshirts, and accessories. Free shipping. Secure Square checkout.",
  alternates: { canonical: "/" },
};

const categoryTiles = [
  { label: "Men", href: "/men", image: "/campaign/hero-men.jpg" },
  { label: "Women", href: "/women", image: "/campaign/hero-women.jpg" },
  { label: "Unisex", href: "/unisex", image: "/campaign/hero-unisex.jpg" },
  { label: "Accessories", href: "/accessories", image: "/campaign/hero-accessories.jpg" },
];

export default async function HomePage() {
  const products = await getAllProducts();
  const featured = products.slice(0, 8);

  return (
    <div className="pb-20 pt-14 lg:pb-28">
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <Image
          src="/campaign/hero-home.jpg"
          alt="After Hours Agenda campaign"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void/60 via-void/40 to-void/80" />
        <div className="relative z-10 mx-auto max-w-[1280px] px-4 py-20 text-center sm:px-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">NYC Streetwear</p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(3rem,12vw,8rem)] font-bold leading-[0.85] tracking-[-0.055em] text-white">
            After Hours Agenda
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
            Made-to-order streetwear for the second shift. Tees, hoodies, sweatshirts, and accessories for men, women, and every body.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/men" className="btn-primary px-7">Shop Men</Link>
            <Link href="/women" className="btn-primary px-7">Shop Women</Link>
            <Link href="/about" className="btn-secondary border-white/30 text-white hover:border-accent hover:text-accent">Read the Agenda</Link>
          </div>
        </div>
      </section>

      <div className="mt-0">
        <TrustStrip />
      </div>

      <section aria-labelledby="categories-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Shop by category</p>
          <h2 id="categories-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-none tracking-[-0.045em] text-cream">The collection</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {categoryTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group relative aspect-[3/4] overflow-hidden image-hover-zoom"
            >
              <Image
                src={tile.image}
                alt={`${tile.label} category`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void/80 via-void/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                <p className="font-display text-xl font-bold uppercase tracking-[-0.02em] text-white md:text-2xl">{tile.label}</p>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent opacity-0 transition-opacity group-hover:opacity-100">Shop now →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Featured</p>
            <h2 id="featured-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-none tracking-[-0.045em] text-cream">Right now</h2>
          </div>
          <Link href="/unisex" className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent underline underline-offset-4 hover:text-cream md:block">Shop everything</Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-4">
            {featured.map((product, index) => (
              <Link key={product.id} href={`/product/${product.slug}`} className="group block focus-visible:outline-offset-4">
                <div className="image-hover-zoom relative aspect-[3/4] overflow-hidden bg-charcoal">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    priority={index < 4}
                    className="object-contain p-3 product-art"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <div className="mt-3">
                  <h3 className="line-clamp-2 font-display text-sm font-bold uppercase leading-tight tracking-[-0.02em] text-cream group-hover:text-accent">{product.name}</h3>
                  <p className="mt-1 font-mono text-xs font-bold text-muted">{product.priceFormatted}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Check back soon for new drops.</p>
        )}
      </section>

      <section aria-labelledby="dispatch-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="relative overflow-hidden bg-charcoal px-6 py-14 text-center sm:px-10 md:py-20">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The Dispatch</p>
          <h2 id="dispatch-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-none tracking-[-0.045em] text-cream">Join the second shift</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Get first access to drops, lookbooks, and a one-time 10% off code.</p>
          <form name="newsletter" method="POST" data-netlify="true" className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row" action="/newsletter">
            <input type="hidden" name="form-name" value="newsletter" />
            <label htmlFor="home-email" className="sr-only">Email address</label>
            <input
              id="home-email"
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="h-12 flex-1 border border-border/10 bg-void px-4 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button type="submit" className="btn-primary">Subscribe</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="manifesto-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden bg-charcoal lg:aspect-auto lg:min-h-[30rem]">
            <Image
              src="/campaign/hero-unisex.jpg"
              alt="After Hours Agenda streetwear"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The agenda</p>
            <h2 id="manifesto-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em] text-cream">Built for the second shift</h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted md:text-base">
              <p>After Hours Agenda is an independent NYC label for people who keep working after the day job ends. Every piece is made to order and printed on demand, which means less waste and no unsold stock.</p>
              <p>We design for every body. Our fits are unisex, our graphics are loud, and our process is responsible. Browse the full catalog or read the story.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/about" className="btn-primary">Read the story</Link>
              <Link href="/lookbook" className="btn-secondary">View lookbook</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
