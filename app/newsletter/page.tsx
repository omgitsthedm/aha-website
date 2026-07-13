import type { Metadata } from "next";
import Link from "next/link";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "After Hours Dispatch",
  description: "Join the After Hours Agenda email list for product releases, restocks, and occasional notes from the design index.",
  alternates: { canonical: "/newsletter" },
};

export default function NewsletterPage() {
  return <main className="pb-20 pt-28 md:pt-32"><div className="px-4 md:px-6"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="After Hours Dispatch" title="The useful email" description="Product releases, restocks, and design notes. No daily noise, no purchased lists, and an unsubscribe link in every marketing message." /><div className="grid gap-6 border-y border-border/40 py-7 md:grid-cols-3"><section><h2 className="font-display text-lg font-bold uppercase">Releases</h2><p className="mt-2 text-sm leading-relaxed text-muted">A direct link when a real product release is ready to shop.</p></section><section><h2 className="font-display text-lg font-bold uppercase">Restocks</h2><p className="mt-2 text-sm leading-relaxed text-muted">Availability notes when something returns—not invented scarcity.</p></section><section><h2 className="font-display text-lg font-bold uppercase">Design notes</h2><p className="mt-2 text-sm leading-relaxed text-muted">Occasional context from the working product and design archive.</p></section></div></div></div><GetOnTheList /><div className="px-4 md:px-6"><p className="mx-auto max-w-4xl text-sm text-muted">Looking for one specific product? <Link href="/restock" className="text-accent underline underline-offset-4">Request a restock alert instead</Link>.</p></div></main>;
}
