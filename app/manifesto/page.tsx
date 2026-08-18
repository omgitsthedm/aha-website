import Link from "next/link";
import Image from "next/image";
import { loadBrandImagery } from "@/lib/content/brand-imagery";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Manifesto",
  description: "After Hours Agenda is an independent New York label. You never needed permission to belong here.",
  path: "/manifesto",
});

const tenets = [
  ["Made after hours", "The work begins when the day quiets down — after the job, after the noise. That is the name."],
  ["No permission needed", "The black sheep is the point: loud, quiet, funny, defiant. Nobody has to earn a place in the city."],
  ["Built with intention", "Printed one at a time, when you order. Nothing made to sit in a warehouse; nothing waiting to be discounted."],
] as const;

export default function ManifestoPage() {
  const { archive } = loadBrandImagery();
  const prologue = archive.find((item) => item.src.includes("prologue")) ?? archive[0];
  return (
    <div className="overflow-hidden">
      <section aria-labelledby="manifesto-heading" className="mx-auto max-w-[1280px] px-4 pb-16 pt-28 sm:px-6 lg:pt-36">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">Independent · New York · Est. 2011</p>
            <h1 id="manifesto-heading" className="mt-5 font-display text-[clamp(2.75rem,9vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.05em] text-cream">You never needed<br /><span className="text-accent">permission</span><br />to belong here</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">After Hours Agenda is an independent New York label. Graphic tees, heavyweight hoods and crewnecks — drawn after hours, printed to order.</p>
            <div className="mt-8 flex flex-wrap gap-4"><Link href="/shop" className="btn-primary px-7">Shop the collection</Link><Link href="#newsletter" className="btn-secondary px-7">Get the next release first</Link></div>
          </div>
          <div className="neon-sign m-scale flex items-center justify-center"><div className="neon-flicker flex w-full max-w-[420px] flex-col items-center"><NeonSheep className="aspect-[1866/1464] w-full" /><p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">The Black Sheep</p></div></div>
        </div>
      </section>
      <section aria-label="What the label stands for" className="border-y border-border/40 bg-surface"><div className="mx-auto max-w-[1280px] divide-y divide-border/40 px-4 sm:px-6">{tenets.map(([title, body], index) => <article key={title} className="m-rise grid gap-3 py-7 md:grid-cols-[5rem_minmax(12rem,0.65fr)_minmax(0,1.35fr)] md:items-baseline md:gap-8 md:py-9"><p className="font-mono text-xs font-bold tracking-[0.12em] text-accent">0{index + 1}</p><h2 className="font-display text-xl font-bold uppercase tracking-[-0.025em] text-cream">{title}</h2><p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{body}</p></article>)}</div></section>
      <section aria-labelledby="prologue-heading" className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <figure className="frame relative aspect-[4/3] overflow-hidden bg-charcoal">
            <Image src={prologue.src} alt={prologue.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white">The Prologue, as it ran on the first site · January 2012</figcaption>
          </figure>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">The Prologue · January 2012</p>
            <h2 id="prologue-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.04em] text-cream">We didn’t break the mold. We’re here to create a new one.</h2>
            <p className="mt-6 max-w-xl font-mono text-sm leading-relaxed text-cream/90">“This is the counter-culture for those that don’t follow the rules. We are the after party. We are dreamers. We are believers that life is a celebration. We do not segregate. We create, and we build. When everyone says ‘no,’ we scream ‘yes.’”</p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">Fourteen years later the sheet is still the brief. <Link href="/about" className="font-bold text-accent underline underline-offset-4">Read the whole story</Link>.</p>
          </div>
        </div>
      </section>
      <section aria-label="The statement" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:pb-28"><SheepMark className="m-rise mb-8 w-16 text-cream" title="The After Hours Agenda black sheep" /><p className="m-rise font-display text-[clamp(1.6rem,4vw,3rem)] font-bold uppercase leading-[1.05] tracking-[-0.03em] text-cream">Make room for the thing that has not existed yet.</p><p className="m-rise mt-8 max-w-2xl text-base leading-relaxed text-muted md:text-lg">Every release is made deliberately. Sign up to hear about the next one first.</p></section>
      <GetOnTheList />
    </div>
  );
}
