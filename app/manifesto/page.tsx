import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Manifesto",
  description: "After Hours Agenda is an independent New York label. The next collection is in development.",
  path: "/manifesto",
});

const tenets = [
  ["Made after hours", "The work begins when the day quiets down — after the job, after the noise. That is the name."],
  ["No permission needed", "The black sheep is the point: loud, quiet, funny, defiant. Nobody has to earn a place in the city."],
  ["Built with intention", "The prior collection is archived. The next release starts with room to make something new."],
] as const;

export default function ManifestoPage() {
  return (
    <div className="overflow-hidden">
      <section aria-labelledby="manifesto-heading" className="mx-auto max-w-[1280px] px-4 pb-16 pt-28 sm:px-6 lg:pt-36">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">Independent · New York · Est. 2011</p>
            <h1 id="manifesto-heading" className="mt-5 font-display text-[clamp(2.75rem,9vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.05em] text-cream">You never needed<br /><span className="text-accent">permission</span><br />to belong here</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">After Hours Agenda is an independent New York label. The prior collection is archived while a new chapter takes shape.</p>
            <div className="mt-8 flex flex-wrap gap-4"><Link href="#newsletter" className="btn-primary px-7">Get the next release first</Link><Link href="/about" className="btn-secondary px-7">Read the story</Link></div>
          </div>
          <div className="neon-sign m-scale flex items-center justify-center"><div className="neon-flicker flex w-full max-w-[420px] flex-col items-center"><NeonSheep className="aspect-[1866/1464] w-full" /><p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">The Black Sheep</p></div></div>
        </div>
      </section>
      <section aria-label="What the label stands for" className="border-y border-border/40 bg-surface"><div className="mx-auto max-w-[1280px] divide-y divide-border/40 px-4 sm:px-6">{tenets.map(([title, body], index) => <article key={title} className="m-rise grid gap-3 py-7 md:grid-cols-[5rem_minmax(12rem,0.65fr)_minmax(0,1.35fr)] md:items-baseline md:gap-8 md:py-9"><p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent">0{index + 1}</p><h2 className="font-display text-xl font-bold uppercase tracking-[-0.025em] text-cream">{title}</h2><p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{body}</p></article>)}</div></section>
      <section aria-label="The statement" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:py-28"><SheepMark className="m-rise mb-8 w-16 text-cream" title="The After Hours Agenda black sheep" /><p className="m-rise font-display text-[clamp(1.6rem,4vw,3rem)] font-bold uppercase leading-[1.05] tracking-[-0.03em] text-cream">Make room for the thing that has not existed yet.</p><p className="m-rise mt-8 max-w-2xl text-base leading-relaxed text-muted md:text-lg">The next release is being made deliberately. Sign up to hear when it is ready.</p></section>
      <GetOnTheList />
    </div>
  );
}
