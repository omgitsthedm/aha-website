import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { SheepMark } from "@/components/ui/SheepMark";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Lookbook",
  description: "The After Hours Agenda collection, printed to order. Campaign imagery arrives with the next release.",
  path: "/lookbook",
  robots: { index: false, follow: true },
});

export default function LookbookPage() {
  return (
    <div className="px-4 pb-12 pt-28 sm:px-6 md:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <PageHeader eyebrow="Lookbook" title="Worn like you mean it" description="Campaign imagery for the current collection is being shot. Until it lands, the collection is live and every piece is on the shop." align="center" />
        <section className="corner-cut crease-rule mt-12 bg-charcoal px-6 py-12 sm:px-10 md:py-16">
          <SheepMark className="mx-auto w-16 text-accent" />
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted md:text-base">Eight pieces, black, printed to order. Shop the collection now, or get the next release announcement first.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/shop" className="btn-primary px-6">Shop the collection</Link><Link href="#newsletter" className="btn-secondary px-6">Get release updates</Link></div>
        </section>
      </div>
      <GetOnTheList />
    </div>
  );
}
