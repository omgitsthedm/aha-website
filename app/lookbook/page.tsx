import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Lookbook",
  description:
    "The current After Hours Agenda lineup, laid out flat: tees, hoodies, sweatshirts, and accessories — every piece shoppable and printed to order.",
  alternates: { canonical: "/lookbook" },
};

// Every look shows real garment mockups of live products; the product list
// under each image is the exact set pictured.
const editorialLooks = [
  {
    image: "/campaign/hero-home.jpg",
    eyebrow: "The lineup",
    title: "Start here",
    note: "Three ways into the label: loud color, clean logo, soft warmth.",
    products: [
      { label: "Be You tee", href: "/product/be-you" },
      { label: "Classic AHA hoodie", href: "/product/classic-black-unisex-hoodie" },
      { label: "Hope & Tomorrow sweatshirt", href: "/product/hope-tomorrow-pink-unisex-premium-sweatshirt" },
    ],
    aspect: "aspect-[4/5]",
  },
  {
    image: "/campaign/hero-men.jpg",
    eyebrow: "Heavyweights",
    title: "Statement hoodies",
    note: "Premium pullover hoodies with graphics that carry the conversation.",
    products: [
      { label: "Enemy of the State hoodie", href: "/product/enemy-of-the-state-unisex-hoodie" },
      { label: "Japanese Garden Puzzle hoodie", href: "/product/japanese-garden-puzzle-charcoal-unisex-hoodie" },
    ],
    aspect: "aspect-[3/4]",
  },
  {
    image: "/campaign/hero-women.jpg",
    eyebrow: "Soft tones",
    title: "Color you can live in",
    note: "Dusty rose and lavender premium sweatshirts, printed to order.",
    products: [
      { label: "Hope & Tomorrow sweatshirt", href: "/product/hope-tomorrow-pink-unisex-premium-sweatshirt" },
      { label: "Haze sweatshirt", href: "/product/haze-lavender-unisex-premium-sweatshirt" },
    ],
    aspect: "aspect-[4/3]",
  },
  {
    image: "/campaign/hero-unisex.jpg",
    eyebrow: "Unisex",
    title: "One cut, worn your way",
    note: "The unisex core: heavyweight fleece built for long nights.",
    products: [
      { label: "No Place Like New York sweatshirt", href: "/product/no-place-like-new-york-charcoal-unisex-premium-sweatshirt" },
      { label: "EMO But In Heels hoodie", href: "/product/emo-but-in-heels-dark-grey-unisex-hoodie" },
    ],
    aspect: "aspect-square",
  },
  {
    image: "/campaign/hero-accessories.jpg",
    eyebrow: "Accessories",
    title: "The finishing move",
    note: "Embroidered dad hats and pin sets. Small pieces, heavy presence.",
    products: [
      { label: "Dad hat", href: "/product/dad-hat" },
      { label: "Retro dad hat", href: "/product/retro-dad-hat" },
      { label: "Pin set #1", href: "/product/set-1-of-pin-buttons" },
    ],
    aspect: "aspect-[3/4]",
  },
];

export default function LookbookPage() {
  return (
    <main className="bg-void">
      {/* 1. Hero */}
      <section className="px-4 pt-28 sm:px-6 md:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                Lookbook
              </p>
              <h1 className="mt-5 font-display text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.055em] text-cream">
                The current lineup
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
                Every piece we make right now, laid out flat. Each look below is
                built from live products — tap through and order the exact
                garment pictured.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/shop" className="btn-primary min-h-12 px-7">
                  Shop all products
                </Link>
                <Link href="/unisex" className="btn-secondary min-h-12 px-7">
                  Shop unisex
                </Link>
              </div>
            </div>
            <div className="fold-surface relative aspect-video overflow-hidden">
              <Image
                src="/campaign/hero-lookbook.jpg"
                alt="After Hours Agenda tees and sweatshirts, including the Black Sheep sweatshirt, arranged on a paper background"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Honest framing */}
      <section className="px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            How to read this
          </p>
          <p className="mt-5 text-lg leading-relaxed text-muted md:text-xl">
            These are the real garments, shown flat and unretouched — the same
            production images we check against every order. Campaign
            photography with people in it comes later; the clothes come first.
          </p>
        </div>
      </section>

      {/* 3. Looks grid */}
      <section aria-labelledby="looks-heading" className="px-4 pb-16 sm:px-6 md:pb-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 border-b border-border/40 pb-5 md:mb-14">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
              The looks
            </p>
            <h2
              id="looks-heading"
              className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em] text-cream"
            >
              Shop the lineup
            </h2>
          </div>

          <div className="columns-1 gap-4 space-y-4 md:columns-2 lg:columns-3">
            {editorialLooks.map((look) => (
              <article key={look.image} className="break-inside-avoid">
                <div className={`image-hover-zoom relative ${look.aspect} overflow-hidden border border-border/40`}>
                  <Image
                    src={look.image}
                    alt={`${look.eyebrow} — ${look.title}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="mt-4 border-t border-border/40 pt-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
                    {look.eyebrow}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold leading-[0.95] tracking-[-0.025em] text-cream">
                    {look.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {look.note}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {look.products.map((product) => (
                      <li key={product.href}>
                        <Link
                          href={product.href}
                          className="inline-flex min-h-9 items-center text-sm font-bold text-accent underline underline-offset-4 hover:text-cream"
                        >
                          {product.label} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Newsletter CTA */}
      <section
        aria-labelledby="newsletter-heading"
        className="border-t border-border/40 bg-void px-4 py-16 md:py-24"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            Newsletter
          </p>
          <h2
            id="newsletter-heading"
            className="mt-4 font-display text-[clamp(2rem,6vw,4rem)] font-bold leading-[0.92] tracking-[-0.04em] text-cream"
          >
            Get the next release first
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
            New releases and the occasional note from the shop. No spam.
          </p>
          <form
            name="newsletter"
            method="POST"
            data-netlify="true"
            action="/newsletter"
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:items-start"
          >
            <input type="hidden" name="form-name" value="newsletter" />
            <label htmlFor="lookbook-email" className="sr-only">
              Email address
            </label>
            <input
              id="lookbook-email"
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="min-h-12 flex-1 border border-border/40 bg-void px-4 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button type="submit" className="btn-primary min-h-12 px-6">
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-xs text-muted">Unsubscribe anytime.</p>
        </div>
      </section>
    </main>
  );
}
