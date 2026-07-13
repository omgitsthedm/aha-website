import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | After Hours Agenda",
  description:
    "After Hours Agenda is independent NYC streetwear made after the day job. Made-to-order, printed in NYC, and built for the second shift.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    number: "01",
    title: "Independent",
    body: "No boardroom. No investor mandate. Just a side hustle that stayed honest. Every design starts after the day job ends, so the work stays personal and the brand stays free.",
  },
  {
    number: "02",
    title: "Inclusive",
    body: "Unisex cuts, extended sizing, and graphics that don&apos;t ask permission. The clothes are made for bodies, not binaries. Wear them your way.",
  },
  {
    number: "03",
    title: "Sustainable",
    body: "Made to order means nothing is printed until someone wants it. No landfill piles of unsold stock. Less waste, more intention.",
  },
];

const steps = [
  {
    title: "Design",
    body: "Graphics are built from the project archive after hours. Each piece is refined, sampled, and approved before it ever hits the site.",
  },
  {
    title: "Print",
    body: "Orders are printed one at a time in NYC. Production usually takes 2-5 business days, because rushing the work isn&apos;t the point.",
  },
  {
    title: "Ship",
    body: "Once production is done, the piece ships direct. Tracking is provided as soon as the carrier takes custody. No warehouse, no middleman.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-void text-cream">
      {/* 1. Hero */}
      <section className="relative flex min-h-[75vh] items-end sm:min-h-[80vh]">
        <Image
          src="/campaign/hero-home.jpg"
          alt="After Hours Agenda campaign hero"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/90 via-[#1a1a1a]/50 to-[#1a1a1a]/30" />
        <div className="relative z-10 w-full px-4 pb-16 pt-32 sm:px-6 md:pb-24 md:pt-40">
          <div className="mx-auto max-w-[1440px]">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Brand manifesto
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(3rem,11vw,8rem)] font-bold uppercase leading-[0.86] tracking-[-0.055em] text-white">
              Built for the second shift
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              Independent NYC streetwear designed after the day job, printed on
              demand, and made for anyone still grinding past 5 PM.
            </p>
            <div className="mt-8">
              <Link href="/shop" className="btn-primary min-h-12 px-8">
                Shop the collection
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 pb-24 pt-16 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-[1440px]">
          {/* 2. Values */}
          <section aria-labelledby="values-heading" className="border-t border-border/10 pt-12 md:pt-16">
            <p
              id="values-heading"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent"
            >
              What we stand for
            </p>
            <div className="mt-10 grid gap-px bg-border/10 md:grid-cols-3">
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
            className="mt-24 border-t border-border/10 pt-12 md:mt-32 md:pt-16"
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
            className="mt-24 grid gap-8 border-y border-border/10 py-12 md:mt-32 md:grid-cols-2 md:items-center md:gap-16 md:py-0"
          >
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-full md:min-h-[32rem]">
              <Image
                src="/campaign/hero-unisex.jpg"
                alt="After Hours Agenda unisex campaign shot in NYC"
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
                Designed and produced in NYC
              </h2>
              <div className="mt-6 max-w-lg space-y-5 text-sm leading-relaxed text-muted md:text-base">
                <p>
                  After Hours Agenda started as a side project in a small
                  Brooklyn apartment. The founder sketched graphics after work,
                  refined them on weekends, and found a network of NYC printers
                  who could produce pieces one at a time.
                </p>
                <p>
                  Today the operation is still local. Design happens here.
                  Production happens here. The grit of the city is part of the
                  product.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Founder / studio */}
          <section
            aria-labelledby="founder-heading"
            className="mt-24 grid gap-8 md:mt-32 md:grid-cols-2 md:items-center md:gap-16"
          >
            <div className="order-2 py-2 md:order-1 md:py-16 md:pl-10 lg:pl-16">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Studio
              </p>
              <h2
                id="founder-heading"
                className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.04em]"
              >
                One desk, one printer, one rule
              </h2>
              <div className="mt-6 max-w-lg space-y-5 text-sm leading-relaxed text-muted md:text-base">
                <p>
                  The studio is small by choice. No open floor plan, no
                  all-hands meetings, no investor slide decks. Just a desk, a
                  printer, and a single rule: if it wouldn&apos;t be worn after a
                  double shift, it doesn&apos;t get made.
                </p>
                <p>
                  The founder bio is still being written—mostly in the form of
                  late-night mockups and test prints. Check back, or sign up
                  below to watch it unfold.
                </p>
              </div>
            </div>
            <div className="relative order-1 aspect-[4/3] overflow-hidden md:order-2 md:aspect-auto md:h-full md:min-h-[32rem]">
              <Image
                src="/campaign/hero-lookbook.jpg"
                alt="After Hours Agenda studio and lookbook campaign"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </section>

          {/* 6. Newsletter CTA */}
          <section
            aria-labelledby="dispatch-heading"
            className="mt-24 border-y border-border/10 py-12 md:mt-32 md:py-20"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                After Hours Dispatch
              </p>
              <h2
                id="dispatch-heading"
                className="mt-4 font-display text-[clamp(2rem,6vw,4rem)] font-bold leading-[0.92] tracking-[-0.04em]"
              >
                Join The Dispatch
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
                Early access to drops + 10% off your first order.
              </p>
              <form
                name="newsletter"
                method="POST"
                data-netlify="true"
                action="/newsletter"
                className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:items-start"
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
                  className="min-h-12 flex-1 border border-border/10 bg-void px-4 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
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
