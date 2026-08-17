import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Release Updates",
  description: "The prior After Hours Agenda collection is archived. Join the list for the next release.",
  path: "/restock",
  robots: { index: false, follow: true },
});

export default function RestockPage() {
  return <main className="px-4 pb-12 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl"><PageHeader eyebrow="Release updates" title="The next collection is on the way" description="The previous collection will not be restocked. Join the list for the next release instead." /><p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">Need help with an existing order? <Link href="/contact" className="text-accent underline underline-offset-4">Contact support</Link> with the order number and checkout email.</p></div><GetOnTheList /></main>;
}
