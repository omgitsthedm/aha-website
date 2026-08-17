import { buildMetadata } from "@/components/seo/buildMetadata";
import Link from "next/link";
import Image from "next/image";

export const metadata = buildMetadata({
  title: "Lookbook",
  description:
    "A visual archive of After Hours Agenda campaign work.",
  path: "/lookbook",
});

// Label-owned campaign compositions. This is editorial only while the catalog
// is migrated; it must not point at archived product detail pages.
const editorialLooks = [
  {
    image: "/campaign/hero-home.jpg",
    eyebrow: "The lineup",
    title: "Start here",
    note: "Three ways into the label: loud color, clean logo, soft warmth.",
    aspect: "aspect-[4/5]",
  },
  {
    image: "/campaign/hero-men.jpg",
    eyebrow: "Heavyweights",
    title: "Statement hoodies",
    note: "Premium pullover hoodies with graphics that carry the conversation.",
    aspect: "aspect-[3/4]",
  },
  {
    image: "/campaign/hero-women.jpg",
    eyebrow: "Soft tones",
    title: "Color you can live in",
    note: "Dusty rose and lavender premium sweatshirts, printed to order.",
    aspect: "aspect-[4/3]",
  },
  {
    image: "/campaign/hero-unisex.jpg",
    eyebrow: "Unisex",
    title: "One cut, worn your way",
    note: "The unisex core: heavyweight fleece built for long nights.",
    aspect: "aspect-square",
  },
  {
    image: "/campaign/hero-accessories.jpg",
    eyebrow: "Accessories",
    title: "The finishing move",
    note: "Embroidered dad hats and pin sets. Small pieces, heavy presence.",
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
                Campaign archive
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
                A focused visual archive of the label while the next release is
                being prepared.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/#dispatch-heading" className="btn-primary min-h-12 px-7">
                  Get the next release first
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
          <p className="m-rise mt-5 text-lg leading-relaxed text-muted md:text-xl">
            Product and campaign compositions sit together here so you can move
            from the graphic to current price, fit, color, and size without guesswork.
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
              The visual archive
            </h2>
          </div>

          <div className="columns-1 gap-4 space-y-4 md:columns-2 lg:columns-3">
            {editorialLooks.map((look) => (
              <article key={look.image} className="m-rise break-inside-avoid">
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
              className="min-h-12 flex-1 border border-border/40 bg-void px-4 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none"
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
