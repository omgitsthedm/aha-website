import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { SocialProofWall } from "@/components/homepage/SocialProofWall";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { loadBrandImagery } from "@/lib/content/brand-imagery";
import { splitProductName } from "@/lib/utils/product-name";

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

export default async function HomePage() {
  const [products, imagery] = await Promise.all([getAllProducts(), Promise.resolve(loadBrandImagery())]);
  const lookbookTeaser = imagery.lookbook.filter((shot) => shot.aspect === "4:5").slice(0, 3);
  const panels = [
    { image: imagery.hero, title: "The collection", sub: "Eight pieces. Printed to order.", href: "/shop", priority: true },
    { image: imagery.gift, title: "The lookbook", sub: "For you, and the people you buy for.", href: "/lookbook", priority: false },
  ];

  return (
    <div className="pb-20 lg:pb-28">
      {/* Two portraits, two doors. She is the left panel; the person she buys
          for is the right. Both files are cut 4:5 on the subject, so the crop
          holds on a phone (stacked), an iPad (side by side, tall) and a wide
          desktop alike. This is the only dark surface on the site — the tokens
          are inverted (void = paper), so the colours here are literal. */}
      <section aria-label="Enter" className="grid bg-[#0b0b0c] text-white lg:h-[calc(100svh-3.5rem)] lg:min-h-[640px] lg:grid-cols-2">
        {panels.map((panel) => (
          <Link key={panel.href} href={panel.href} className="group relative block aspect-[4/5] overflow-hidden sm:aspect-[5/6] lg:aspect-auto lg:h-full">
            <Image
              src={panel.image.src}
              alt={panel.image.alt}
              fill
              priority={panel.priority}
              fetchPriority={panel.priority ? "high" : "auto"}
              sizes="(max-width: 1024px) 100vw, 50vw"
              quality={72}
              className="object-cover object-center transition-transform duration-[1600ms] ease-out group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 px-6 pb-9 sm:px-8 sm:pb-12 lg:px-10 lg:pb-14">
              <span className="editorial-title block text-[clamp(2.25rem,5.5vw,4.5rem)] text-white">{panel.title}</span>
              <span className="mt-3 block font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/85 sm:text-sm">{panel.sub}</span>
              <span className="mt-5 inline-flex min-h-11 items-center border border-white/60 px-5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors group-hover:bg-white group-hover:text-[#0b0b0c]">Enter</span>
            </div>
          </Link>
        ))}
      </section>

      {/* The line. Set large, in the brand's own voice. */}
      <section aria-labelledby="hero-heading" className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-8 lg:pt-28">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">After Hours Agenda · New York · Est. 2011</p>
        <h1 id="hero-heading" className="editorial-title mt-6 max-w-5xl text-[clamp(2.5rem,6.5vw,6rem)] text-cream">
          For the people still building a life <em>after everyone else clocks out.</em>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">Graphic tees, heavyweight hoods and crewnecks — drawn when the day quiets down, printed one at a time when you order.</p>
      </section>

      <section aria-labelledby="collection-heading" className="mx-auto mt-20 max-w-[1440px] px-5 sm:px-8 lg:mt-28">
        <div className="mb-10 flex items-end justify-between gap-6">
          <h2 id="collection-heading" className="editorial-title text-[clamp(2rem,4.5vw,3.75rem)] text-cream">The collection</h2>
          <Link href="/shop" className="hidden font-mono text-xs font-bold uppercase tracking-[0.16em] text-cream underline decoration-border underline-offset-8 hover:decoration-cream md:block">See all eight</Link>
        </div>
        {products.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6" data-testid="home-collection-grid">
            {products.map((product) => {
              const image = product.images[0];
              const hover = product.images[1];
              const { name, garment } = splitProductName(product.name);
              return (
                <li key={product.id}>
                  <Link href={`/product/${product.slug}`} className="group block focus-visible:outline-offset-4">
                    <div className="image-hover-zoom relative aspect-[4/5] overflow-hidden bg-surface">
                      {image ? (
                        <>
                          <ResilientImage src={image} alt={product.name} fill loading="lazy" className={`object-cover product-art ${hover ? "transition-opacity duration-500 group-hover:opacity-0" : ""}`} sizes="(max-width: 768px) 50vw, 25vw" />
                          {hover && <ResilientImage src={hover} alt="" aria-hidden="true" fill loading="lazy" className="object-cover product-art opacity-0 transition-opacity duration-500 group-hover:opacity-100" sizes="(max-width: 768px) 50vw, 25vw" />}
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase text-muted">Image unavailable</div>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3 className="font-display text-base font-black uppercase leading-tight tracking-[-0.03em] text-cream group-hover:text-accent md:text-lg">{name}</h3>
                      <p className="mt-1.5 flex items-center justify-between gap-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        <span>{garment ?? "Printed to order"}</span>
                        <span className="text-cream">{product.priceFormatted}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-base text-muted">The next release is on the press. <Link href="#dispatch-heading" className="font-bold text-accent underline underline-offset-4">Get it first</Link>.</p>
        )}
        <div className="mt-10 md:hidden">
          <Link href="/shop" className="btn-primary w-full justify-center">See all eight</Link>
        </div>
      </section>

      {/* The story. The after-hours character is the maker — never a niche. */}
      <section aria-labelledby="story-heading" className="mx-auto mt-28 max-w-[1440px] px-5 sm:px-8 lg:mt-36">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <div className="relative aspect-[4/3] overflow-hidden bg-charcoal">
            <Image src={imagery.maker.src} alt={imagery.maker.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">The Prologue · January 2012</p>
            <blockquote id="story-heading" className="editorial-title mt-5 text-[clamp(1.75rem,3.6vw,3.25rem)] text-cream">
              “When everyone says <em>no,</em> we scream <em>yes.</em> We didn’t break the mold — we’re here to create a new one.”
            </blockquote>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">The name is literal. Every graphic gets drawn after the day job ends — the last train, the kitchen table, the roof at 2am — then printed one at a time when you order it. Nothing waits in a warehouse to be discounted.</p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link href="/about" className="btn-primary px-8">The story since 2011</Link>
              <Link href="/manifesto" className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cream underline decoration-border underline-offset-8 hover:decoration-cream">Manifesto</Link>
            </div>
          </div>
        </div>
      </section>

      {lookbookTeaser.length > 0 && (
        <section aria-labelledby="lookbook-heading" className="mx-auto mt-28 max-w-[1440px] px-5 sm:px-8 lg:mt-36">
          <div className="mb-10 flex items-end justify-between gap-6">
            <h2 id="lookbook-heading" className="editorial-title text-[clamp(2rem,4.5vw,3.75rem)] text-cream">Worn like <em>you</em> mean it</h2>
            <Link href="/lookbook" className="hidden font-mono text-xs font-bold uppercase tracking-[0.16em] text-cream underline decoration-border underline-offset-8 hover:decoration-cream md:block">The lookbook</Link>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {lookbookTeaser.map((shot) => (
              <Link key={shot.src} href={shot.productSlug ? `/product/${shot.productSlug}` : "/lookbook"} className="image-hover-zoom relative block aspect-[4/5] overflow-hidden bg-surface">
                <Image src={shot.src} alt={shot.alt} fill loading="lazy" className="object-cover" sizes="33vw" />
              </Link>
            ))}
          </div>
          <div className="mt-8 md:hidden">
            <Link href="/lookbook" className="btn-secondary w-full justify-center">The lookbook</Link>
          </div>
        </section>
      )}

      <section aria-labelledby="statement-heading" className="mx-auto mt-28 max-w-[1440px] px-5 sm:px-8 lg:mt-36">
        <div className="grid items-center gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="neon-sign m-scale flex items-center justify-center">
            <div className="neon-flicker flex w-full max-w-[380px] flex-col items-center">
              <NeonSheep className="aspect-[1866/1464] w-full" />
              <p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">Est. 2011</p>
            </div>
          </div>
          <div className="m-rise">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">The Black Sheep</p>
            <blockquote id="statement-heading" className="editorial-title mt-5 text-[clamp(2.25rem,5.5vw,5rem)] text-cream">Drawn when the day goes quiet. <em>Made with intention.</em></blockquote>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">Loud, quiet, funny, defiant. Printed one at a time, never asking permission.</p>
          </div>
        </div>
      </section>

      {/* Real, moderated reviews only — renders nothing until they exist. */}
      <SocialProofWall />

      <div id="dispatch-heading"><GetOnTheList /></div>
    </div>
  );
}
