import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SheepMark } from "@/components/ui/SheepMark";
import { NeonSheep } from "@/components/brand/NeonSheep";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { SocialProofWall } from "@/components/homepage/SocialProofWall";

export const metadata: Metadata = {
  title: "Manifesto",
  description:
    "After Hours Agenda is an independent New York label — made after the day job, printed to order, worn by anyone who never needed permission to belong to the city.",
  alternates: { canonical: "/manifesto" },
};

// Current label-owned campaign imagery. This is presented as brand editorial,
// never passed off as customer-generated content.
const feed = [
  { src: "/campaign/lifestyle/men.webp", alt: "After Hours Agenda worn in New York" },
  { src: "/campaign/lifestyle/women.webp", alt: "After Hours Agenda worn in New York" },
  { src: "/campaign/lifestyle/unisex.webp", alt: "After Hours Agenda worn in New York" },
  { src: "/campaign/lifestyle/band.webp", alt: "Friends in After Hours Agenda crossing a New York street" },
  { src: "/brand/photography/sheep-sweatshirt-agave--mens-front.jpg", alt: "The Black Sheep sweatshirt in agave" },
  { src: "/campaign/lifestyle/accessories.webp", alt: "After Hours Agenda accessories" },
];

const tenets = [
  { k: "Made after hours", v: "The designs get drawn when the day quiets down — after the job, after the noise. That's the name. It describes when the work happens, never who it's for." },
  { k: "Printed to order", v: "Nothing sits in a warehouse waiting to be discounted. Your piece enters production only after you order it." },
  { k: "No permission needed", v: "The black sheep is the whole point. Loud, quiet, funny, defiant — you don't have to earn a place in the city. You already belong to it." },
];

export default function ManifestoPage() {
  return (
    <div className="overflow-hidden">
      {/* ── Flag ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="manifesto-heading" className="mx-auto max-w-[1280px] px-4 pb-16 pt-28 sm:px-6 lg:pt-36">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="m-stagger">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">Independent · New York · Est. 2011</p>
            <h1 id="manifesto-heading" className="mt-5 font-display text-[clamp(2.75rem,9vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.05em] text-cream">
              You never needed<br /><span className="text-accent">permission</span><br />to belong here
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              After Hours Agenda is expressive everyday clothing from New York — made after the day job, printed to order, worn a hundred different ways. This is the whole idea, in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/shop" className="btn-primary px-7">Shop the label</Link>
              <Link href="/lookbook" className="btn-secondary">See the lookbook</Link>
            </div>
          </div>
          <div className="neon-sign m-scale flex items-center justify-center">
            <div className="neon-flicker flex w-full max-w-[420px] flex-col items-center">
              <NeonSheep className="aspect-[1866/1464] w-full" />
              <p className="neon2-text mt-3 font-mono text-sm font-bold uppercase tracking-[0.35em]">The Black Sheep</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tenets ───────────────────────────────────────────────────────── */}
      <section aria-label="What the label stands for" className="border-y border-border/40 bg-surface">
        <div className="mx-auto max-w-[1280px] divide-y divide-border/40 px-4 sm:px-6">
          {tenets.map((t, index) => (
            <article key={t.k} className="m-rise grid gap-3 py-7 md:grid-cols-[5rem_minmax(12rem,0.65fr)_minmax(0,1.35fr)] md:items-baseline md:gap-8 md:py-9">
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent">0{index + 1}</p>
              <h2 className="font-display text-xl font-bold uppercase tracking-[-0.025em] text-cream">{t.k}</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t.v}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── The statement ────────────────────────────────────────────────── */}
      <section aria-label="The statement" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:py-28">
        <SheepMark className="m-rise mb-8 w-16 text-cream" title="The After Hours Agenda black sheep" />
        <p className="m-rise font-display text-[clamp(1.6rem,4vw,3rem)] font-bold uppercase leading-[1.05] tracking-[-0.03em] text-cream">
          The same tee belongs on a 20-year-old heading to a show and a 40-year-old mom on the school run — without either one borrowing it from the other.
        </p>
        <p className="m-rise mt-8 max-w-2xl text-base leading-relaxed text-muted">
          Most brands niche you. They decide who&rsquo;s allowed to wear the thing, then sell you the feeling of qualifying. We don&rsquo;t. After hours describes the maker, never the wearer. If it speaks to you, it&rsquo;s yours.
        </p>
      </section>

      {/* Current label-owned campaign edit. */}
      <section aria-labelledby="feed-heading" className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">Campaign edit</p>
            <h2 id="feed-heading" className="mt-2 font-display text-[clamp(1.75rem,5vw,3.5rem)] font-black uppercase leading-none tracking-[-0.045em]">Worn in New York</h2>
          </div>
          <a href="https://www.instagram.com/afterhoursagenda" target="_blank" rel="noopener noreferrer" className="m-underline inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Follow @afterhoursagenda</a>
        </div>
        <div className="m-stagger grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {feed.map((f, i) => (
            <div key={f.src + i} className="hover-fold group relative aspect-square overflow-hidden">
              <Image src={f.src} alt={f.alt} fill loading="lazy" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" sizes="(max-width: 768px) 50vw, 33vw" />
            </div>
          ))}
        </div>
      </section>

      {/* Real, moderated reviews only — renders nothing until they exist. */}
      <SocialProofWall />

      {/* ── Next drop (honest — no fake timers; reuses the tested signup) ── */}
      <GetOnTheList />
    </div>
  );
}
