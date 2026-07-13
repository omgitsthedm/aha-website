import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Lookbook | After Hours Agenda",
  description:
    "Outside Hours — an editorial lookbook from After Hours Agenda. NYC streetwear made for the second shift: men, women, unisex, and accessories shot after dark.",
  alternates: { canonical: "/lookbook" },
};

const editorialLooks = [
  {
    href: "/shop",
    image: "/campaign/hero-home.jpg",
    eyebrow: "Drop 001",
    title: "The opening statement",
    note: "Oversized tees and heavyweight hoodies shot on Canal after midnight. Fit: relaxed. Fabric: 240gsm cotton.",
    aspect: "aspect-[4/5]",
  },
  {
    href: "/shop",
    image: "/campaign/hero-men.jpg",
    eyebrow: "Men's",
    title: "Boxy cuts, clean type",
    note: "No logos bigger than the idea. Key pieces: black hoodie, classic tee, straight-leg sweatpants.",
    aspect: "aspect-[3/4]",
  },
  {
    href: "/shop",
    image: "/campaign/hero-women.jpg",
    eyebrow: "Women's",
    title: "Cropped, tailored, unbothered",
    note: "Form-forward silhouettes with room to move. Key pieces: fitted tee, oversized crew, cropped hoodie.",
    aspect: "aspect-[4/3]",
  },
  {
    href: "/unisex",
    image: "/campaign/hero-unisex.jpg",
    eyebrow: "Unisex",
    title: "Built for every body",
    note: "Core palette: black, cement, and sky. Genderless fits designed to live in, not pose in.",
    aspect: "aspect-square",
  },
  {
    href: "/shop",
    image: "/campaign/hero-accessories.jpg",
    eyebrow: "Accessories",
    title: "The finishing move",
    note: "Beanies, caps, and everyday carry. Small pieces, heavy presence.",
    aspect: "aspect-[3/4]",
  },
];

export default function LookbookPage() {
  return (
    <main className="bg-void">
      {/* 1. Full-bleed hero */}
      <section className="relative min-h-[70vh] md:min-h-[80vh]">
        <Image
          src="/campaign/hero-lookbook.jpg"
          alt="After Hours Agenda lookbook campaign"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />
        <div className="relative flex min-h-[70vh] flex-col justify-center px-4 pt-28 pb-16 md:min-h-[80vh] md:pt-32 md:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="hero-copy-enter font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Lookbook
            </p>
            <h1 className="hero-title-line mt-5 font-display text-[clamp(3rem,10vw,7rem)] font-bold leading-[0.86] tracking-[-0.055em] text-white">
              Outside Hours
            </h1>
            <p className="hero-support-enter mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              Made-to-order streetwear for the second shift. A visual index of the pieces we build after the day job ends.
            </p>
            <div className="hero-actions-enter mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/shop" className="btn-primary min-h-12 px-7">
                Shop the collection
              </Link>
              <Link href="/unisex" className="btn-secondary min-h-12 px-7 text-white/90 hover:text-accent">
                Shop unisex
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Editorial intro */}
      <section className="px-4 py-16 sm:px-6 md:py-24">
        <div className="container-narrow mx-auto text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            Editorial
          </p>
          <p className="mt-5 text-lg leading-relaxed text-muted md:text-xl">
            This is not a catalog. It is a mood board for the hours between clocking out and showing up again. Every image was shot in the city we call home, using the same pieces you can order — no sample-only styling, no borrowed sets.
          </p>
        </div>
      </section>

      {/* 3. Masonry lookbook grid */}
      <section aria-labelledby="looks-heading" className="px-4 pb-16 sm:px-6 md:pb-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 border-b border-border/10 pb-5 md:mb-14">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
              The looks
            </p>
            <h2
              id="looks-heading"
              className="mt-2 font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-none tracking-[-0.045em] text-cream"
            >
              Outside Hours
            </h2>
          </div>

          <div className="columns-1 gap-4 space-y-4 md:columns-2 lg:columns-3">
            {editorialLooks.map((look) => (
              <article key={look.image} className="break-inside-avoid">
                <Link href={look.href} className="group block">
                  <div className={`image-hover-zoom relative ${look.aspect}`}>
                    <Image
                      src={look.image}
                      alt={`${look.eyebrow} — ${look.title}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="mt-4 border-t border-border/10 pt-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
                      {look.eyebrow}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold leading-[0.95] tracking-[-0.025em] text-cream group-hover:text-accent">
                      {look.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {look.note}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Newsletter CTA */}
      <section
        aria-labelledby="dispatch-heading"
        className="border-t border-border/10 bg-void px-4 py-16 md:py-24"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            After Hours Dispatch
          </p>
          <h2
            id="dispatch-heading"
            className="mt-4 font-display text-[clamp(2rem,6vw,4rem)] font-bold leading-[0.92] tracking-[-0.04em] text-cream"
          >
            Join The Dispatch
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
            Early access to drops, restock alerts, and lookbook exclusives. No spam.
          </p>
          <form
            name="newsletter"
            method="POST"
            data-netlify="true"
            action="/newsletter"
            className="mt-8 flex max-w-md flex-col gap-3 sm:mx-auto sm:flex-row sm:items-start"
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
              className="min-h-12 flex-1 border border-border/10 bg-void px-4 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
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
