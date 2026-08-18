import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Release Updates",
  description: "After Hours Agenda release updates. The current collection is live; join the list for the next one.",
  path: "/restock",
  robots: { index: false, follow: true },
});

export default function RestockPage() {
  return <main className="px-4 pb-12 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl"><PageHeader eyebrow="Release updates" title="Release updates" description="Retired designs are not restocked; the current collection is live on the shop, and new pieces are announced by email first." /><p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted"><Link href="/shop" className="text-accent underline underline-offset-4">Shop the collection</Link>, or for help with an order <Link href="/contact" className="text-accent underline underline-offset-4">contact support</Link> with the order number and checkout email.</p></div><GetOnTheList /></main>;
}
