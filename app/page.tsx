import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";
import { TrustStrip } from "@/components/ui/TrustStrip";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";

export const metadata: Metadata = {
  title: "After Hours Agenda | NYC Streetwear",
  description:
    "NYC streetwear made to order. Men's, women's, and unisex tees, hoodies, sweatshirts, and accessories. Free shipping. Secure Square checkout.",
  alternates: { canonical: "/" },
};

const categoryTiles = [
  { label: "Men", href: "/men", image: "/products/enemy-of-the-state-unisex-hoodie/01-black-unisex-premium-hoodie-front.webp" },
  { label: "Women", href: "/women", image: "/products/hope-tomorrow-pink-unisex-premium-sweatshirt/01-dusty-rose-unisex-premium-sweatshirt-front.webp" },
  { label: "Unisex", href: "/unisex", image: "/products/no-place-like-new-york-charcoal-unisex-premium-sweatshirt/01-charcoal-heather-unisex-premium-sweatshirt-front-and-back.webp" },
  { label: "Accessories", href: "/accessories", image: "/products/dad-hat/01-classic-dad-hat-black-front.webp" },
];

export default async function HomePage() {
  const products = await getAllProducts();
  const featured = products.slice(0, 8);

  return (
    <div className="pb-20 pt-14 lg:pb-28">
      <section aria-labelledby="hero-heading" className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">NYC Streetwear · Made to order</p>
            <h1 id="hero-heading" className="mt-5 font-display text-[clamp(2.75rem,8vw,5.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.05em] text-cream">
              After Hours <span className="text-accent">Agenda</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              Expressive everyday clothing from New York. Tees, hoodies, sweatshirts, and accessories — printed to order, one at a time.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/men" className="btn-primary px-7">Shop Men</Link>
              <Link href="/women" className="btn-primary px-7">Shop Women</Link>
              <Link href="/new-arrivals" className="btn-secondary">Shop new arrivals</Link>
            </div>
          </div>
          <div className="neon-sign flex items-center justify-center">
            <div className="neon-flicker flex w-full max-w-[460px] flex-col items-center">
              <NeonSheep className="aspect-[1866/1464] w-full" />
              <p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">Est. 2011</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-0">
        <TrustStrip />
      </div>

      <section aria-labelledby="categories-heading" className="reveal-block mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Shop by category</p>
          <h2 id="categories-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">The collection</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {categoryTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="fold-surface group relative aspect-[3/4] overflow-hidden image-hover-zoom"
            >
              <Image
                src={tile.image}
                alt={`${tile.label} category`}
                fill
                className="object-contain p-6"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                <p className="font-display text-xl font-bold uppercase tracking-[-0.02em] text-cream md:text-2xl">{tile.label}</p>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent opacity-0 transition-opacity group-hover:opacity-100">Shop now →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="reveal-block mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Featured</p>
            <h2 id="featured-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">Right now</h2>
          </div>
          <Link href="/unisex" className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent underline underline-offset-4 hover:text-cream md:block">Shop everything</Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-4">
            {featured.map((product, index) => (
              <Link key={product.id} href={`/product/${product.slug}`} className="group block focus-visible:outline-offset-4">
                <div className="fold-surface image-hover-zoom relative aspect-[3/4] overflow-hidden">
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

      <section aria-labelledby="worn-heading" className="reveal-block mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The Black Sheep</p>
            <h2 id="worn-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">Worn, not just shown</h2>
          </div>
          <SheepMark className="hidden w-16 text-cream md:block" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/product/black-sheep-mint-unisex-premium-sweatshirt" className="fold-surface group relative aspect-[4/5] overflow-hidden image-hover-zoom">
            <Image src="/brand/photography/sheep-sweatshirt-agave--mens-front.jpg" alt="The Black Sheep sweatshirt in agave, worn" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/20 to-transparent p-5">
              <p className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-cream group-hover:text-accent">Black Sheep Sweatshirt — Agave</p>
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Shop it →</p>
            </div>
          </Link>
          <Link href="/product/black-sheep-bone-unisex-premium-sweatshirt" className="fold-surface group relative aspect-[4/5] overflow-hidden image-hover-zoom">
            <Image src="/brand/photography/sheep-sweatshirt-bone--womens-front.jpg" alt="The Black Sheep sweatshirt in bone, worn" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/20 to-transparent p-5">
              <p className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-cream group-hover:text-accent">Black Sheep Sweatshirt — Bone</p>
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Shop it →</p>
            </div>
          </Link>
        </div>
      </section>

      <section aria-labelledby="dispatch-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="corner-cut crease-rule relative overflow-hidden bg-charcoal px-6 py-14 text-center sm:px-10 md:py-20">
          <SheepMark className="mx-auto mb-4 w-16 text-cream" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#B03246]">Newsletter</p>
          <h2 id="dispatch-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">Get the next release first</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">New releases and the occasional note from the shop. No spam, unsubscribe anytime.</p>
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
          <div>
            <div className="relative aspect-[4/5] overflow-hidden bg-charcoal lg:aspect-auto lg:min-h-[30rem]">
              <Image
                src="/campaign/hero-unisex-onmodel.webp"
                alt="The No Place Like New York sweatshirt in charcoal, worn"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Pictured:{" "}
              <Link href="/product/no-place-like-new-york-charcoal-unisex-premium-sweatshirt" className="font-bold text-accent underline underline-offset-4 hover:text-cream">No Place Like New York sweatshirt</Link>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The agenda</p>
            <h2 id="manifesto-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-cream">Made after hours. Worn all day.</h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted md:text-base">
              <p>After Hours Agenda is an independent New York label — the name is literal. Designs get drawn when the day quiets down, then printed one at a time when you order. Nothing sits in a warehouse waiting to be discounted.</p>
              <p>The graphics run loud, quiet, funny, and defiant. The cuts are unisex and worn a hundred different ways. Nobody here needs permission to belong — that&apos;s the whole point.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/about" className="btn-primary">Read the story</Link>
              <Link href="/lookbook" className="btn-secondary">View the lookbook</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
