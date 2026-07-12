import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { BRAND_TERRITORIES } from "@/lib/content/site-copy";

export const metadata = {
  title: "About the Independent NYC Label",
  description: "The story and point of view behind After Hours Agenda: an independent New York graphic label, its left-facing black sheep, and the ideas that start after the schedule ends.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader eyebrow="Independent label / New York" title="The agenda starts after the plan" description="After Hours Agenda is a graphic label for the second shift: the work, music, reading, wandering, arguing, and making that begins when somebody else's schedule ends." />

        <section aria-labelledby="origin-heading" className="grid border-y border-border/40 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative min-h-[28rem] border-b border-border/40 bg-cream lg:min-h-[42rem] lg:border-b-0 lg:border-r">
            <Image src="/brand/sheep-full.svg" alt="After Hours Agenda black sheep mark" fill className="object-contain p-10 md:p-16" sizes="(max-width: 1024px) 100vw, 42vw" />
          </div>
          <div className="flex flex-col justify-center p-6 md:p-10 lg:p-14">
            <h2 id="origin-heading" className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">The black sheep is not lost</h2>
            <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-cream/85 md:text-base">
              <p className="text-lg font-bold text-cream">It is the person who stopped following a schedule written by somebody else.</p>
              <p>AHA has spent years turning the things that refuse to stay in one category—New York, books, music, politics, optimism, memory, and pop debris—into graphics you can wear.</p>
              <p>The sheep faces left. It stands outside the line without turning away from the world. That is the whole point: independence without isolation.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop all pieces</Link>
              <Link href="/lookbook" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">See AHA in the city</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="ideas-heading" className="py-20 md:py-28">
          <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">What belongs in the archive</p>
          <h2 id="ideas-heading" className="max-w-4xl font-display text-[clamp(2.8rem,7vw,6.5rem)] font-black uppercase leading-[0.84] tracking-[-0.065em]">The subject changes. The point of view does not.</h2>
          <div className="mt-10 grid gap-px border border-border/40 bg-border/40 md:grid-cols-2">
            {BRAND_TERRITORIES.map(({ title, body }) => (
              <div key={title} className="bg-void p-6 md:p-8">
                <h3 className="font-display text-2xl font-black uppercase tracking-[-0.04em]">{title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="made-heading" className="grid border-y border-border/40 bg-charcoal lg:grid-cols-[1fr_1fr]">
          <div className="relative min-h-[28rem] border-b border-border/40 lg:border-b-0 lg:border-r">
            <Image src="/brand/lifestyle/lifestyle-4.jpg" alt="After Hours Agenda clothing worn after dark" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
          <div className="flex flex-col justify-center p-6 md:p-10 lg:p-14">
            <h2 id="made-heading" className="font-display text-[clamp(2.5rem,5vw,4.75rem)] font-black uppercase leading-[0.87] tracking-[-0.055em]">The graphic comes first. The order comes second.</h2>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted md:text-base">AHA keeps an active design index instead of manufacturing piles of speculative inventory. A production partner prints each piece after it is ordered; production usually takes 2-5 business days before carrier transit begins.</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">Every product page shows the live price and size options alongside fit, fabric, care, production, shipping, and return guidance. Standard shipping is included, and unworn pieces have a 30-day return window.</p>
            <Link href="/shipping" className="mt-7 inline-flex min-h-11 w-fit items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase hover:border-accent hover:text-accent">See the order timeline</Link>
          </div>
        </section>

        <section aria-labelledby="for-heading" className="grid gap-8 py-20 md:grid-cols-[0.7fr_1.3fr] md:py-28">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Who this is for</p>
          <div>
            <h2 id="for-heading" className="max-w-4xl font-display text-[clamp(2.7rem,6vw,5.75rem)] font-black uppercase leading-[0.84] tracking-[-0.065em]">Anybody with a second life after the first one clocks out</h2>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted">The bartender writing a book. The designer finishing one more version. The reader on the last train. The organizer, the night walker, the record obsessive, the person making a plan nobody assigned. You do not need a title or a permission slip.</p>
            <Link href="/shop" className="primary-action mt-7 min-h-11 px-5 py-3 text-xs">Find your piece</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
