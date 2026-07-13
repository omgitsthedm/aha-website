import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Release Archive",
  description: "Browse documented After Hours Agenda releases as the archive grows. No release history is invented to make the label look older or busier than it is.",
  alternates: { canonical: "/drops/archive" },
};

export default function ReleaseArchivePage() {
  return <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-5xl"><PageHeader eyebrow="Active archive" title="Release archive" description="Finished releases will live here with their original product edit, images, and notes. The archive begins when a release has real material worth preserving." /><section className="grid gap-6 border-y border-border/40 py-8 md:grid-cols-[1fr_auto] md:items-end"><div><p className="font-display text-2xl font-bold uppercase">No retired releases yet</p><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">The storefront is being rebuilt around the current catalog. We will not manufacture past seasons, dates, sell-through, or campaign history to fill a grid.</p></div><div className="flex flex-wrap gap-3"><Link href="/drops/current" className="primary-action min-h-11 px-5 py-3 text-xs">View current release</Link><Link href="/newsletter" className="secondary-action min-h-11 px-5 py-3 text-xs">Get release email</Link></div></section></div></main>;
}
