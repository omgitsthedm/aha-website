import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = {
  title: "About the Independent NYC Label",
  description: "Meet After Hours Agenda, an independent New York streetwear label built around graphic apparel, the black sheep point of view, and life after dark.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader eyebrow="Independent label / New York" title="The agenda starts when the day ends" description="After Hours Agenda makes graphic clothing for people who keep a life outside the expected schedule." />

        <section aria-labelledby="origin-heading" className="grid border-y border-border/40 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative min-h-[28rem] border-b border-border/40 bg-cream lg:min-h-[42rem] lg:border-b-0 lg:border-r">
            <Image src="/brand/sheep-full.svg" alt="After Hours Agenda black sheep mark" fill className="object-contain p-10 md:p-16" sizes="(max-width: 1024px) 100vw, 42vw" />
          </div>
          <div className="flex flex-col justify-center p-6 md:p-10 lg:p-14">
            <h2 id="origin-heading" className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">The black sheep is not lost</h2>
            <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-cream/85 md:text-base">
              <p className="text-lg font-bold text-cream">It is the person who stopped following a schedule written by somebody else.</p>
              <p>The label began in New York with designs about independence, optimism, books, music, politics, memory, and the strange ideas that survive a late night.</p>
              <p>The sheep faces left. It stands apart from the line without turning away from the world. That is the entire brief.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop all pieces</Link>
              <Link href="/lookbook" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">See the label outside</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="ideas-heading" className="py-20 md:py-28">
          <h2 id="ideas-heading" className="max-w-4xl font-display text-[clamp(2.8rem,7vw,6.5rem)] font-black uppercase leading-[0.84] tracking-[-0.065em]">Every collection begins with an idea</h2>
          <div className="mt-10 grid gap-px border border-border/40 bg-border/40 md:grid-cols-2">
            {[
              ["Black Sheep", "Stand apart without shrinking yourself."],
              ["No Kings", "Lead yourself. Borrow no throne."],
              ["Night Mode", "Protect the work made between midnight and dawn."],
              ["NYC Forever", "Carry the city without turning it into a costume."],
            ].map(([name, copy]) => (
              <div key={name} className="bg-void p-6 md:p-8">
                <h3 className="font-display text-2xl font-black uppercase tracking-[-0.04em]">{name}</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="made-heading" className="grid border-y border-border/40 bg-charcoal lg:grid-cols-[1fr_1fr]">
          <div className="relative min-h-[28rem] border-b border-border/40 lg:border-b-0 lg:border-r">
            <Image src="/brand/lifestyle/lifestyle-4.jpg" alt="After Hours Agenda clothing worn after dark" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
          <div className="flex flex-col justify-center p-6 md:p-10 lg:p-14">
            <h2 id="made-heading" className="font-display text-[clamp(2.5rem,5vw,4.75rem)] font-black uppercase leading-[0.87] tracking-[-0.055em]">Made when you choose it</h2>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted md:text-base">AHA pieces are made to order through a production partner. Production usually takes 2-5 business days, shipping is free, and unworn items have a 30-day return window.</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">The product page shows fit, fabric, care, size, price, and delivery expectations before you add anything to your bag.</p>
            <Link href="/shipping" className="mt-7 inline-flex min-h-11 w-fit items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase hover:border-accent hover:text-accent">How orders move</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
