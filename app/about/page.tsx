import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { SheepMark } from "@/components/ui/SheepMark";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "About",
  description: "After Hours Agenda is an independent New York label. Drawn after hours, printed one at a time when you order.",
  path: "/about",
});

const values = [
  ["01", "Independent", "Every design starts after the day job ends, so the work stays personal and the brand stays free."],
  ["02", "New York", "The city is the reference point: lived-in, direct, and never interested in asking permission."],
  ["03", "Intentional", "Nothing sits in a warehouse waiting to be discounted. Every piece is printed one at a time, when you order it."],
] as const;

export default function AboutPage() {
  return (
    <div className="px-4 pb-12 pt-28 sm:px-6 md:pt-36">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader eyebrow="About the label" title="Made after hours" description="After Hours Agenda is an independent New York label. Graphic tees, heavyweight hoods and crewnecks — drawn when the day quiets down, printed to order." />
        <section aria-labelledby="values-heading" className="mt-16 border-t border-border/40 pt-8">
          <p id="values-heading" className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">What we stand for</p>
          <div className="mt-8 border-t border-border/40">
            {values.map(([number, title, body]) => <article key={title} className="grid gap-4 border-b border-border/40 py-7 sm:grid-cols-[3rem_minmax(0,0.65fr)_minmax(0,1.35fr)] sm:gap-8"><span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">{number}</span><h2 className="font-display text-2xl font-bold uppercase tracking-[-0.03em] sm:text-3xl">{title}</h2><p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{body}</p></article>)}
          </div>
        </section>
        <section className="mt-16 border-y border-border/40 py-12 text-center">
          <SheepMark className="mx-auto w-16 text-accent" />
          <h2 className="mt-5 font-display text-[clamp(2rem,5vw,4rem)] font-bold uppercase leading-none tracking-[-0.045em]">What comes next</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base"><Link href="/shop" className="text-accent underline underline-offset-4">Shop the collection</Link>, or <Link href="/track-order" className="text-accent underline underline-offset-4">track an order</Link>. New pieces land here first — join the list below.</p>
        </section>
      </div>
      <GetOnTheList />
    </div>
  );
}
