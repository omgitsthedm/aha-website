import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "After Hours Agenda is an independent NYC label. Every piece is designed after the day job and printed to order — nothing sits in a warehouse.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    number: "01",
    title: "Independent",
    body: "No boardroom, no investor mandate. Every design starts after the day job ends, so the work stays personal and the brand stays free.",
  },
  {
    number: "02",
    title: "Unisex by design",
    body: "One cut, worn your way. Sizing runs deep on most pieces, and every product page lists exact measurements so you can pick with confidence.",
  },
  {
    number: "03",
    title: "Made to order",
    body: "Nothing is printed until someone orders it. That means no clearance racks and no unsold stock in a warehouse — just the piece you asked for.",
  },
];

const steps = [
  {
    title: "Design",
    body: "Graphics are drawn and refined in New York, after hours. If it wouldn't get worn on a real day, it doesn't get made.",
  },
  {
    title: "Print",
    body: "Your order is printed one at a time by our production partner. Production usually takes 2 to 5 business days before shipping.",
  },
  {
    title: "Ship",
    body: "Once production is done, the piece ships to you with free shipping. Tracking arrives as soon as the carrier takes custody.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-void text-cream">
      {/* 1. Hero */}
      <section className="px-4 pb-4 pt-28 sm:px-6 md:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                About the label
              </p>
              <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.055em]">
                Made after hours
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
                After Hours Agenda is an independent New York label. Every piece
                is designed after the day job and printed to order.
              </p>
              <div className="mt-8">
                <Link href="/shop" className="btn-primary min-h-12 px-8">
                  Shop all products
                </Link>
              </div>
            </div>
            <div className="fold-surface relative aspect-video overflow-hidden">
              <Image
                src="/campaign/hero-home.jpg"
                alt="After Hours Agenda garments laid out on paper: the Be You tee, Classic AHA hoodie, and Hope and Tomorrow sweatshirt"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 pb-24 pt-16 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-[1440px]">
          {/* 2. Values */}
          <section aria-labelledby="values-heading" className="border-t border-border/40 pt-12 md:pt-16">
            <p
              id="values-heading"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent"
            >
              What we stand for
            </p>
            <div className="mt-10 grid gap-px bg-border/40 md:grid-cols-3">
              {values.map((value) => (
                <article
                  key={value.title}
                  className="bg-void p-6 sm:p-8 lg:p-10"
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">
                    {value.number}
                  </span>
                  <h2 className="mt-4 font-display text-2xl font-bold uppercase tracking-[-0.03em] sm:text-3xl">
                    {value.title}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
                    {value.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* 3. The process */}
          <section
            aria-labelledby="process-heading"
            className="mt-24 border-t border-border/40 pt-12 md:mt-32 md:pt-16"
          >
            <div className="grid gap-12 lg:grid-cols-[0.6fr_1.4fr] lg:gap-20">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                  The process
                </p>
                <h2
                  id="process-heading"
                  className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em]"
                >
                  Design → Print → Ship
                </h2>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-muted md:text-base">
                  Every piece is made to order. No bulk runs, no clearance
                  racks, no unsold stock collecting dust in a warehouse.
                </p>
              </div>
              <ol className="grid gap-6 md:grid-cols-3 md:gap-4">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="relative border-l-2 border-accent pl-5"
                  >
                    <span
                      className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted"
                      aria-hidden="true"
                    >
                      Step 0{index + 1}
                    </span>
                    <h3 className="mt-2 font-display text-xl font-bold uppercase tracking-[-0.02em]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* 4. NYC origin */}
          <section
            aria-labelledby="nyc-heading"
            className="mt-24 grid gap-8 border-y border-border/40 py-12 md:mt-32 md:grid-cols-2 md:items-center md:gap-16 md:py-0"
          >
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-full md:min-h-[32rem]">
              <Image
                src="/campaign/hero-unisex.jpg"
                alt="After Hours Agenda sweatshirt and hoodie mockups on a paper background"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="py-2 md:py-16 md:pr-10 lg:pr-16">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Origin
              </p>
              <h2
                id="nyc-heading"
                className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em]"
              >
                Designed in New York, after hours
              </h2>
              <div className="mt-6 max-w-lg space-y-5 text-sm leading-relaxed text-muted md:text-base">
                <p>
                  The name is literal. This label is what happens after the
                  workday ends — sketches on the commute, revisions late at
                  night, releases when they&apos;re actually ready.
                </p>
                <p>
                  Design happens in New York. Printing is handled to order by
                  our production partner, one piece at a time, so nothing is
                  made that nobody asked for.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Studio */}
          <section
            aria-labelledby="studio-heading"
            className="mt-24 grid gap-8 md:mt-32 md:grid-cols-2 md:items-center md:gap-16"
          >
            <div className="order-2 py-2 md:order-1 md:py-16 md:pl-10 lg:pl-16">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Studio
              </p>
              <h2
                id="studio-heading"
                className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em]"
              >
                Small by choice
              </h2>
              <div className="mt-6 max-w-lg space-y-5 text-sm leading-relaxed text-muted md:text-base">
                <p>
                  No open floor plan, no all-hands meetings, no investor slide
                  decks. Just one rule: if it wouldn&apos;t get worn on a real
                  day, it doesn&apos;t get made.
                </p>
                <p>
                  Questions about a product, an order, or the label? Email{" "}
                  <a href="mailto:info@afterhoursagenda.com" className="text-accent underline underline-offset-4">
                    info@afterhoursagenda.com
                  </a>{" "}
                  and a person will answer.
                </p>
              </div>
            </div>
            <div className="relative order-1 aspect-[4/3] overflow-hidden md:order-2 md:aspect-auto md:h-full md:min-h-[32rem]">
              <Image
                src="/campaign/hero-lookbook.jpg"
                alt="After Hours Agenda tees and sweatshirts arranged on a paper background"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </section>

          {/* 6. Newsletter CTA */}
          <section
            aria-labelledby="newsletter-heading"
            className="mt-24 border-y border-border/40 py-12 md:mt-32 md:py-20"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Newsletter
              </p>
              <h2
                id="newsletter-heading"
                className="mt-4 font-display text-[clamp(2rem,6vw,4rem)] font-bold leading-[0.92] tracking-[-0.04em]"
              >
                Get the next release first
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
                New releases and the occasional note from the shop.
              </p>
              <form
                name="newsletter"
                method="POST"
                data-netlify="true"
                action="/newsletter"
                className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:items-start"
              >
                <input type="hidden" name="form-name" value="newsletter" />
                <label htmlFor="about-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="about-email"
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
              <p className="mt-4 text-xs text-muted">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
