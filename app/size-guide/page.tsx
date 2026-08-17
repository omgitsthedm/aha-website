import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Sizing Update",
  description: "Sizing information for the next After Hours Agenda collection will be published with the release.",
  path: "/size-guide",
  robots: { index: false, follow: true },
});

export default function SizeGuidePage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Sizing update" title="Details arrive with the new collection" description="The prior collection&apos;s sizing information has been retired. New sizing and fit guidance will be published with the next release." />
      <section className="border-y border-border/40 py-8"><p className="max-w-2xl text-sm leading-relaxed text-muted">If you need help with a completed order from the prior collection, include your order number and checkout email when you <Link href="/contact" className="text-accent underline underline-offset-4">contact support</Link>.</p></section>
    </div></div>
  );
}
