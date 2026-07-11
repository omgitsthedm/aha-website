import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = {
  title: "About",
  description: "The point of view behind After Hours Agenda, an independent New York streetwear label.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Independent label / New York" title="Built after hours" description="After Hours Agenda is for people who make their own lane. The clothes carry that point of view without asking for permission." />
        <div className="grid border-y border-border/40 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex min-h-80 items-center justify-center border-b border-border/40 bg-cream p-10 lg:border-b-0 lg:border-r">
            <Image src="/brand/sheep-head.svg" alt="After Hours Agenda black sheep mark" width={280} height={280} className="h-auto w-full max-w-64" />
          </div>
          <div className="space-y-6 p-6 text-sm leading-relaxed text-cream/85 md:p-10 md:text-base">
            <p className="text-lg font-bold text-cream">The work started in New York, in the hours after the expected work was done.</p>
            <p>Every collection begins with an idea: stand apart, lead yourself, protect the hours that belong to you, and carry the city without turning it into a costume.</p>
            <p><strong className="text-cream">Black Sheep</strong> centers the people who do not fit the brief. <strong className="text-cream">No Kings</strong> rejects borrowed authority. <strong className="text-cream">Night Mode</strong> belongs to the work made between midnight and dawn. <strong className="text-cream">NYC Forever</strong> carries the city that shaped the label.</p>
            <p>Pieces are made to order through our production partner. That keeps the catalog flexible and means production begins after purchase.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop the catalog</Link>
              <Link href="/shipping" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">How orders are made</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
