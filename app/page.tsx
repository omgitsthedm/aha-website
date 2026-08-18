import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
import { loadBrandImagery } from "@/lib/content/brand-imagery";
import { getCategoryBySlug } from "@/lib/commerce/taxonomy";

// Same ISR window as /shop: the grid below reads the live Square-backed
// catalog, so the front door and the shop can never disagree about what sells.
export const revalidate = 300;

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Independent NYC Label",
    shareTitle: "After Hours Agenda | New York",
    description:
      "Independent New York label, est. 2011. Graphic tees, heavyweight hoods and crewnecks, drawn after hours and printed one at a time when you order.",
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
  const [products, imagery] = await Promise.all([getAllProducts(), Promise.resolve(loadBrandImagery())]);
  const spotlight = products.find((p) => p.slug === SPOTLIGHT_SLUG) ?? products[0];
  const lookbookTeaser = imagery.lookbook.filter((shot) => shot.aspect === "4:5").slice(0, 3);
  const categoryTiles = (["t-shirts", "hoodies-sweatshirts"] as const)
    .map((slug) => ({ meta: getCategoryBySlug(slug), image: imagery.categories[slug], slug }))
    .filter((tile) => tile.meta && tile.image);

  return (
    <div className="pb-20 lg:pb-28">
      {/* Hero — one photograph, one sentence, one door into the shop. */}
      {/* Photograph on ink. This is the one surface on the site that is dark:
          the tokens are inverted (void = paper), so the colours here are literal. */}
      <section aria-labelledby="hero-heading" className="relative isolate min-h-[78vh] overflow-hidden bg-[#0b0b0c] text-white lg:min-h-[86vh]">
        <Image
          src={imagery.hero.src}
          alt={imagery.hero.alt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-[1440px] flex-col justify-end px-4 pb-14 pt-32 sm:px-6 lg:min-h-[86vh] lg:pb-20">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-rose">Independent NYC label · Est. 2011 · Printed to order</p>
          <h1 id="hero-heading" className="mt-5 max-w-3xl font-display text-[clamp(3rem,8vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.05em]">After Hours <span className="text-rose">Agenda</span></h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">For the people still building a life after everyone else clocks out. Graphic tees, heavyweight hoods and crewnecks — drawn when the day quiets down, printed one at a time when you order.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/shop" className="btn-primary px-7">Shop the collection</Link>
            <Link href="/lookbook" className="inline-flex min-h-11 items-center border border-white/50 px-7 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:border-white hover:bg-white hover:text-[#0b0b0c]">View the lookbook</Link>
          </div>
        </div>
      </section>

      <TrustStrip />

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
            {products.map((product) => {
              const image = product.images[0];
              const hover = product.images[1];
              return (
                <li key={product.id}>
                  <Link href={`/product/${product.slug}`} className="paper-lift group block focus-visible:outline-offset-4">
                    <div className="fold-surface relative aspect-[4/5] overflow-hidden bg-surface">
                      {image ? (
                        <>
                          <ResilientImage src={image} alt={product.name} fill loading="lazy" className={`object-cover product-art ${hover ? "transition-opacity duration-300 group-hover:opacity-0" : ""}`} sizes="(max-width: 768px) 50vw, 25vw" />
                          {hover && <ResilientImage src={hover} alt="" aria-hidden="true" fill loading="lazy" className="object-cover product-art opacity-0 transition-opacity duration-300 group-hover:opacity-100" sizes="(max-width: 768px) 50vw, 25vw" />}
                        </>
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

      {/* The story — the after-hours character is the maker, never a niche customer. */}
      <section aria-labelledby="story-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
          <div className="fold-surface relative aspect-[16/10] overflow-hidden lg:aspect-[4/3]">
            <Image src={imagery.maker.src} alt={imagery.maker.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">The agenda</p>
            <h2 id="story-heading" className="mt-4 font-display text-[clamp(2rem,5vw,3.75rem)] font-bold uppercase leading-[0.9] tracking-[-0.045em] text-cream">Made after hours. Worn all day.</h2>
            <p className="mt-6 text-base leading-relaxed text-muted">The name is literal. Every graphic gets drawn after the day job ends — on the last train, at the kitchen table, on a roof at 2am — then printed one at a time when you order it. Nothing sits in a warehouse waiting to be discounted.</p>
            <blockquote className="mt-6 border-l-2 border-accent pl-5 font-mono text-sm leading-relaxed text-cream">“We create, and we build. When everyone says ‘no,’ we scream ‘yes.’ We didn’t break the mold; we’re just here to create a new one.” <cite className="not-italic text-muted">— The Prologue, January 2012</cite></blockquote>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/about" className="btn-primary">Read the story</Link>
              <Link href="/manifesto" className="btn-secondary">The manifesto</Link>
            </div>
          </div>
        </div>
      </section>

      {categoryTiles.length > 0 && (
        <section aria-labelledby="categories-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
          <h2 id="categories-heading" className="sr-only">Shop by garment</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {categoryTiles.map(({ slug, meta, image }) => (
              <Link key={slug} href={`/shop/${slug}`} className="fold-surface paper-lift image-hover-zoom group relative aspect-[4/3] overflow-hidden md:aspect-[3/2]">
                <Image src={image!.src} alt={image!.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                  <p className="font-display text-3xl font-black uppercase tracking-[-0.03em] text-white md:text-4xl">{meta!.name}</p>
                  <p className="mt-1 max-w-sm text-sm text-white/80">{meta!.description}</p>
                  <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rose">Shop {meta!.shortName.toLowerCase()} →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {spotlight && (
        <FeaturedGraphic
          product={spotlight}
          eyebrow="Featured graphic"
          story={spotlight.slug === SPOTLIGHT_SLUG ? SPOTLIGHT_STORY : FALLBACK_STORY}
        />
      )}

      {lookbookTeaser.length > 0 && (
        <section aria-labelledby="lookbook-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Lookbook</p>
              <h2 id="lookbook-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">Worn like you mean it</h2>
            </div>
            <Link href="/lookbook" className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent underline underline-offset-4 hover:text-cream md:block">View the lookbook</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {lookbookTeaser.map((shot) => (
              <Link key={shot.src} href={shot.productSlug ? `/product/${shot.productSlug}` : "/lookbook"} className="fold-surface paper-lift image-hover-zoom relative block aspect-[4/5] overflow-hidden">
                <Image src={shot.src} alt={shot.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 33vw, 33vw" />
              </Link>
            ))}
          </div>
          <div className="mt-6 md:hidden">
            <Link href="/lookbook" className="btn-secondary w-full justify-center">View the lookbook</Link>
          </div>
        </section>
      )}

      <section aria-labelledby="statement-heading" className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6 lg:mt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="neon-sign m-scale flex items-center justify-center">
            <div className="neon-flicker flex w-full max-w-[380px] flex-col items-center">
              <NeonSheep className="aspect-[1866/1464] w-full" />
              <p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">Est. 2011</p>
            </div>
          </div>
          <div className="m-rise">
            <SheepMark className="mb-6 w-12 text-accent" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">The Black Sheep · New York</p>
            <blockquote id="statement-heading" className="mt-6 font-display text-[clamp(2.25rem,6vw,4.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.045em] text-cream">Drawn when the day goes quiet. <span className="text-accent">Made</span> with intention.</blockquote>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted md:text-base">Loud, quiet, funny, defiant — every piece is printed one at a time, never asking permission. {SHIPPING_CLAIM_SENTENCE}</p>
          </div>
        </div>
      </section>

      {/* Real, moderated reviews only — renders nothing until they exist. */}
      <SocialProofWall />

      <div id="dispatch-heading"><GetOnTheList /></div>
    </div>
  );
}
