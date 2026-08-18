import Link from "next/link";
import Image from "next/image";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { SheepMark } from "@/components/ui/SheepMark";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { loadBrandImagery } from "@/lib/content/brand-imagery";

export const metadata = buildMetadata({
  title: "About",
  description: "After Hours Agenda is a clothing brand for the dreamers and the doers — good people who work hard, love hard, and celebrate the life they’re building. The story since 2011.",
  path: "/about",
});

// The label's own words, as they ran on the first site. Transcribed from the
// typed sheet in the archive (data/brand-imagery.json → archive[0]).
const PROLOGUE = [
  "Last call. It truly is a universal theme; the idea of limitation and premature ending on the threshold of memories being made. But there are the few, the few that break through the status quo, the adventurous individuals that don’t follow trends but set them.",
  "This is After Hours Agenda. This is the counter-culture for those that don’t follow the rules. We are the after party. We are the facilitators of a great time. We are dreamers. We are believers that life is a celebration. We do not segregate.",
  "We create, and we build. When everyone says “no,” we scream “yes.” We didn’t break the mold, we’re just here to create a new one.",
] as const;

const TIMELINE = [
  ["2011", "The name", "After hours is the part of the day that’s yours — the time you give to the people and the ideas you love once the work is done. A few friends started drawing what that felt like."],
  ["2012", "The Prologue", "A typed, crumpled sheet becomes the entire first website: we are dreamers, we are believers that life is a celebration, we create and we build. The first tees and posters ship."],
  ["2013", "The Black Sheep", "The friendly rebel arrives and never leaves — the one who does things its own way and brings everyone along. Rise & Grind, Love / Vanity, The Best Is Yet To Come."],
  ["2014", "The race to 1,000", "The race to a thousand orders — win one of everything for the thousandth — one printed piece at a time, one kind customer at a time."],
  ["2026", "The reset", "The whole catalog is retired and the label starts again on eight pieces, heavyweight blanks, honest margins, and a promise: made to order, one at a time, never disposable."],
] as const;

const VALUES = [
  ["01", "Kindness", "We make clothes for good people, and we try to be good people to make them for — kind to you, kind to the people who print and pack your order, kind to whoever you buy for."],
  ["02", "Community", "A brand is the people wearing it. Families, friends, teams, the person you love and the ones you look after. The collection is made to be shared and borrowed."],
  ["03", "Work, and the celebration after", "We believe in hard work and in celebrating what it builds. Nothing here is made before someone wants it, and nothing is discounted into meaninglessness."],
  ["04", "Dreamers and doers", "The people who plan the trip and book it. Who start the thing. Who show up for the birthday and the hospital and the graduation. That’s who this is for."],
] as const;

export default function AboutPage() {
  const { maker, signature, archive } = loadBrandImagery();
  const prologueImage = archive.find((item) => item.src.includes("prologue")) ?? archive[0];
  const archiveStrip = archive.filter((item) => item !== prologueImage);

  return (
    <div className="px-4 pb-12 pt-28 sm:px-6 md:pt-36">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader eyebrow="About · Est. 2011" title="For the dreamers and the doers" description="After Hours Agenda is a clothing brand for real people who do real things — good people who work hard, love hard, and celebrate the life they’re building. This is the story so far." />

        <section aria-labelledby="maker-heading" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
          <div className="frame relative aspect-[16/10] overflow-hidden">
            <Image src={maker.src} alt={maker.alt} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">What the name means</p>
            <h2 id="maker-heading" className="mt-3 font-display text-3xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-cream sm:text-4xl">After hours is the part of the day that’s yours</h2>
            <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">The time you give to the people and the ideas you love once the work is done. Dinner with the family. The side project. The long walk, the phone call, the celebration you earned. That is who this is for — the ones still building something good when the day is over — and it always has been.</p>
          </div>
        </section>

        <section aria-labelledby="prologue-heading" className="mt-20 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
          <figure className="frame relative aspect-[4/3] overflow-hidden bg-charcoal">
            <Image src={prologueImage.src} alt={prologueImage.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" />
          </figure>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">The Prologue · January 2012</p>
            <h2 id="prologue-heading" className="mt-3 font-display text-3xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-cream sm:text-4xl">The first thing we wrote down</h2>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-cream/90">
              {PROLOGUE.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
              <p className="text-muted">Join us. 2012.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="timeline-heading" className="mt-20 border-t border-border/40 pt-8">
          <p id="timeline-heading" className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">Fifteen years, in five lines</p>
          <ol className="mt-8 border-t border-border/40">
            {TIMELINE.map(([year, title, body]) => (
              <li key={year} className="grid gap-3 border-b border-border/40 py-7 sm:grid-cols-[5rem_minmax(0,0.6fr)_minmax(0,1.4fr)] sm:gap-8">
                <span className="font-display text-2xl font-black tracking-[-0.03em] text-accent">{year}</span>
                <h3 className="font-display text-xl font-bold uppercase tracking-[-0.025em] text-cream">{title}</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {archiveStrip.length > 0 && (
          <section aria-labelledby="archive-heading" className="mt-20">
            <div className="mb-6 flex items-end justify-between gap-6">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">From the archive</p>
                <h2 id="archive-heading" className="mt-3 font-display text-3xl font-bold uppercase leading-none tracking-[-0.03em] text-cream sm:text-4xl">2012 – 2014</h2>
              </div>
              <p className="hidden max-w-xs text-right text-sm leading-relaxed text-muted md:block">Retired designs, kept for the record. None of these are for sale — the current eight are on the shop.</p>
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-3 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
              {archiveStrip.map((item) => (
                <figure key={item.src} className="w-56 shrink-0 snap-start md:w-auto">
                  <div className="frame relative aspect-[3/4] overflow-hidden bg-charcoal">
                    <Image src={item.src} alt={item.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 60vw, 25vw" />
                  </div>
                  <figcaption className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted"><span className="text-accent">{item.year}</span> · {item.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="values-heading" className="mt-20 border-t border-border/40 pt-8">
          <p id="values-heading" className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">What we stand for</p>
          <div className="mt-8 border-t border-border/40">
            {VALUES.map(([number, title, body]) => <article key={title} className="grid gap-4 border-b border-border/40 py-7 sm:grid-cols-[3rem_minmax(0,0.65fr)_minmax(0,1.35fr)] sm:gap-8"><span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">{number}</span><h2 className="font-display text-2xl font-bold uppercase tracking-[-0.03em] sm:text-3xl">{title}</h2><p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{body}</p></article>)}
          </div>
        </section>

        {signature.length > 0 && (
          <section aria-labelledby="signature-heading" className="mt-20">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">The signature · The Black Sheep</p>
                <h2 id="signature-heading" className="mt-3 font-display text-3xl font-bold uppercase leading-none tracking-[-0.03em] text-cream sm:text-4xl">Worn, not just shown</h2>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted">The friendly rebel the label is named for, from the previous run. The current cut is the <Link href="/product/black-sheep-tee" className="m-underline font-bold text-accent">Black Sheep tee</Link> and the <Link href="/product/sheep-min-hoodie" className="m-underline font-bold text-accent">Sheep Min hood</Link>.</p>
              </div>
              <SheepMark className="hidden w-16 text-cream md:block" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {signature.map((shot) => (
                <div key={shot.src} className="frame relative aspect-[4/5] overflow-hidden">
                  <Image src={shot.src} alt={shot.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-16 border-y border-border/40 py-12 text-center">
          <SheepMark className="mx-auto w-16 text-accent" />
          <h2 className="mt-5 font-display text-[clamp(2rem,5vw,4rem)] font-bold uppercase leading-none tracking-[-0.045em]">Stay close</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base"><Link href="/shop" className="text-accent underline underline-offset-4">Shop the collection</Link>, or <Link href="/track-order" className="text-accent underline underline-offset-4">track an order</Link>. New pieces reach the list first.</p>
        </section>
      </div>
      <GetOnTheList />
    </div>
  );
}
