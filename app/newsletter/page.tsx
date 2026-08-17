import { buildMetadata } from "@/components/seo/buildMetadata";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = buildMetadata({
  title: "Newsletter",
  description: "Join the After Hours Agenda email list for the next release and design notes. No daily noise, no purchased lists, unsubscribe in every message.",
  path: "/newsletter",
});

export default function NewsletterPage() {
  return <main className="pb-20 pt-28 md:pt-32"><div className="px-4 md:px-6"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="Newsletter" title="The useful email" description="Release news and design notes. No daily noise, no purchased lists, and an unsubscribe link in every marketing message." /><div className="grid gap-6 border-y border-border/40 py-7 md:grid-cols-2"><section><h2 className="font-display text-lg font-bold uppercase">Next release</h2><p className="mt-2 text-sm leading-relaxed text-muted">A direct note when the next collection is ready to share.</p></section><section><h2 className="font-display text-lg font-bold uppercase">Design notes</h2><p className="mt-2 text-sm leading-relaxed text-muted">Occasional context from the work as it develops.</p></section></div></div></div><GetOnTheList /></main>;
}
