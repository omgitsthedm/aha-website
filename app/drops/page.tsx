import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Releases",
  description: "Open the current After Hours Agenda release, see what is next, or browse the documented release archive.",
  alternates: { canonical: "/drops" },
};

const releaseRoutes = [
  { href: "/drops/current", title: "Current release", body: "The active product edit with current prices, variants, fit, production, shipping, and return details.", action: "Shop current release" },
  { href: "/coming-soon", title: "What is next", body: "Release status without an invented date, false countdown, or placeholder product promise.", action: "Read release status" },
  { href: "/drops/archive", title: "Release archive", body: "Completed releases will be preserved with their original product edit and verified material.", action: "Open the archive" },
] as const;

export default function DropsPage() {
  return (
    <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Release desk" title="Products arrive when the work is ready" description="Shop what is active, see the state of the next release, or return to completed issues. Dates and scarcity appear only when they are real." />
        <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-3">
          {releaseRoutes.map((route) => (
            <Link key={route.href} href={route.href} className="group flex min-h-72 flex-col justify-between bg-void p-6 transition-colors hover:bg-surface">
              <div><h2 className="font-display text-3xl font-bold uppercase tracking-[-0.035em] group-hover:text-accent">{route.title}</h2><p className="mt-4 text-sm leading-relaxed text-muted">{route.body}</p></div>
              <span className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.06em] text-accent">{route.action}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8"><Link href="/newsletter" className="secondary-action min-h-11 px-5 py-3 text-xs">Get release email</Link></div>
      </div>
    </main>
  );
}
