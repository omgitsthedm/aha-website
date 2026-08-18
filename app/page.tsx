import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/square/catalog";
import { TrustStrip } from "@/components/ui/TrustStrip";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { FeaturedGraphic } from "@/components/homepage/FeaturedGraphic";
import { SocialProofWall } from "@/components/homepage/SocialProofWall";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { SHIPPING_CLAIM_SENTENCE } from "@/lib/commerce/policies";

// Same ISR window as /shop: the grid below reads the live Square-backed
// catalog, so the front door and the shop can never disagree about what sells.
export const revalidate = 300;

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Independent NYC Label",
    shareTitle: "After Hours Agenda | New York",
    description:
      "Independent New York label. Graphic tees, heavyweight hoods and crewnecks, drawn after hours and printed one at a time when you order.",
    path: "/",
  }),
  title: { absolute: "After Hours Agenda | New York" },
};

const SPOTLIGHT_SLUG = "no-kings-tee";
const SPOTLIGHT_STORY =
  "No crowns. No thrones. No permission needed — a statement piece drawn after hours, about self-rule and refusing the easy line.";
const FALLBACK_STORY =
  "Drawn after hours in New York, printed one at a time. A graphic with something to say — worn a hundred different ways.";

export default async function HomePage() {
  const products = await getAllProducts();
  const spotlight = products.find((p) => p.slug === SPOTLIGHT_SLUG) ?? products[0];

  return (
    <div className="pb-20 pt-14 lg:pb-28">
      <section aria-labelledby="hero-heading" className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:pt-16">
        <div className="grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-8 lg:gap-14">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">Independent NYC label · Printed to order</p>
            <h1 id="hero-heading" className="mt-5 font-display text-[clamp(2.75rem,6.8vw,5.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.05em] text-cream">After Hours <span className="text-accent">Agenda</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              Expressive everyday clothing from New York. Graphic tees, heavyweight hoods and crewnecks — drawn when the day quiets down, printed one at a time when you order.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/shop" className="btn-primary px-7">Shop the collection</Link>
              <Link href="/manifesto" className="btn-secondary px-7">Read the manifesto</Link>
            </div>
          </div>
          <div className="hero-visual-enter neon-sign flex items-center justify-center">
            <div className="neon-flicker flex w-full max-w-[380px] flex-col items-center lg:max-w-[460px]">
              <NeonSheep className="aspect-[1866/1464] w-full" />
              <p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">Est. 2011</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-12 lg:mt-16">
        <TrustStrip />
      </div>

      <section aria-labelledby="collection-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The collection</p>
            <h2 id="collection-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">
              {products.length > 0 ? `${products.length} pieces. Black. Printed to order.` : "Printed to order."}
            </h2>
          </div>
          <Link href="/shop" className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent underline underline-offset-4 hover:text-cream md:block">Shop everything</Link>
        </div>
        {products.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-4" data-testid="home-collection-grid">
            {products.map((product, index) => {
              const image = product.images[0];
              return (
                <li key={product.id}>
                  <Link href={`/product/${product.slug}`} className="paper-lift group block focus-visible:outline-offset-4">
                    <div className="fold-surface image-hover-zoom relative aspect-[3/4] overflow-hidden bg-surface">
                      {image ? (
                        <ResilientImage
                          src={image}
                          alt={product.name}
                          fill
                          // Everything here sits below the hero; the LCP element
                          // stays the hero text, so nothing in the grid preloads.
                          loading="lazy"
                          fetchPriority={index < 2 ? "high" : "auto"}
                          className="object-cover product-art"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase text-muted">Image unavailable</div>
                      )}
                    </div>
                    <div className="mt-3">
                      <h3 className="line-clamp-2 font-display text-sm font-bold uppercase leading-tight tracking-[-0.02em] text-cream group-hover:text-accent">{product.name}</h3>
                      <p className="mt-1 font-mono text-xs font-bold text-muted">{product.priceFormatted}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">The next release is on the press. <Link href="#dispatch-heading" className="font-bold text-accent underline underline-offset-4">Get it first</Link>.</p>
        )}
        <div className="mt-8 md:hidden">
          <Link href="/shop" className="btn-primary w-full justify-center">Shop everything</Link>
        </div>
      </section>

      {spotlight && (
        <FeaturedGraphic
          product={spotlight}
          eyebrow="Featured graphic"
          story={spotlight.slug === SPOTLIGHT_SLUG ? SPOTLIGHT_STORY : FALLBACK_STORY}
        />
      )}

      <section aria-labelledby="statement-heading" className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6 lg:mt-32">
        <div className="m-rise mx-auto max-w-4xl text-center">
          <SheepMark className="mx-auto mb-6 w-12 text-accent" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Est. 2011 · New York</p>
          <blockquote id="statement-heading" className="mt-6 font-display text-[clamp(2.25rem,7vw,5rem)] font-bold uppercase leading-[0.92] tracking-[-0.045em] text-cream">Drawn when the day goes quiet. <span className="text-accent">Made</span> with intention.</blockquote>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-muted md:text-base">Loud, quiet, funny, defiant — every piece is printed one at a time, never asking permission. {SHIPPING_CLAIM_SENTENCE}</p>
        </div>
      </section>

      {/* Real, moderated reviews only — renders nothing until they exist. */}
      <SocialProofWall />

      <div id="dispatch-heading"><GetOnTheList /></div>

      <section aria-labelledby="manifesto-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="corner-cut crease-rule relative overflow-hidden bg-charcoal px-6 py-14 sm:px-10 md:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The agenda</p>
            <h2 id="manifesto-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-cream">Made after hours. Worn all day.</h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted md:text-base">
              <p>After Hours Agenda is an independent New York label — the name is literal. Designs get drawn when the day quiets down, then printed one at a time when you order. Nothing sits in a warehouse waiting to be discounted.</p>
              <p>The graphics run loud, quiet, funny, and defiant. The cuts are unisex and worn a hundred different ways. Nobody here needs permission to belong — that&apos;s the whole point.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/shop" className="btn-primary">Shop the collection</Link>
              <Link href="/about" className="btn-secondary">Read the story</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
