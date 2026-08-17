import type { Metadata } from "next";
import Link from "next/link";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Independent NYC Label",
    shareTitle: "After Hours Agenda | New York",
    description: "The previous After Hours Agenda collection is archived. Join the list for the next release.",
    path: "/",
  }),
  title: { absolute: "After Hours Agenda | New York" },
};

/** A deliberately light, collection-free front door while the new work is prepared. */
export default function HomePage() {
  return (
    <div className="pb-20 pt-14 lg:pb-28">
      <section aria-labelledby="hero-heading" className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:pt-16">
        <div className="grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-8 lg:gap-14">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">Independent NYC label · New collection in development</p>
            <h1 id="hero-heading" className="mt-5 font-display text-[clamp(2.75rem,6.8vw,5.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.05em] text-cream">After Hours <span className="text-accent">Agenda</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">The previous collection is archived. We&apos;re making room for what comes next.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="#dispatch-heading" className="btn-primary px-7">Get the next release first</Link>
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

      <section aria-labelledby="statement-heading" className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6 lg:mt-32">
        <div className="m-rise mx-auto max-w-4xl text-center">
          <SheepMark className="mx-auto mb-6 w-12 text-accent" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Est. 2011 · New York</p>
          <blockquote id="statement-heading" className="mt-6 font-display text-[clamp(2.25rem,7vw,5rem)] font-bold uppercase leading-[0.92] tracking-[-0.045em] text-cream">Drawn when the day goes quiet. <span className="text-accent">Made</span> with intention.</blockquote>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-muted md:text-base">The next chapter is being built from the ground up. Join the Agenda and hear about it first.</p>
        </div>
      </section>

      <div id="dispatch-heading"><GetOnTheList /></div>
    </div>
  );
}
