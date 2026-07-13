import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "What Is Coming Next",
  description: "See how After Hours Agenda announces future products and releases without fake dates, countdowns, or availability claims.",
  alternates: { canonical: "/coming-soon" },
};

export default function ComingSoonPage() {
  return <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-5xl"><PageHeader eyebrow="Next release / Date not announced" title="When it is ready, it goes here" description="There is no public launch date or countdown running right now. Future release details will appear only after products, pricing, images, and fulfillment are ready." /><div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3"><section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">First: product</h2><p className="mt-3 text-sm leading-relaxed text-muted">The design, garment, variants, production file, price, and margin must all clear review.</p></section><section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Then: proof</h2><p className="mt-3 text-sm leading-relaxed text-muted">Real product images and verified fit details replace placeholders before a launch promise is made.</p></section><section className="bg-void p-6"><h2 className="font-display text-xl font-bold uppercase">Then: release</h2><p className="mt-3 text-sm leading-relaxed text-muted">A date appears only when the store can take payment and carry the order through production.</p></section></div><div className="mt-8 flex flex-wrap gap-3"><Link href="/newsletter" className="primary-action min-h-11 px-5 py-3 text-xs">Get the release email</Link><Link href="/drops/current" className="secondary-action min-h-11 px-5 py-3 text-xs">Shop what is active</Link></div></div></main>;
}
