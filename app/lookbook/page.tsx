import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { SheepMark } from "@/components/ui/SheepMark";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";

export const metadata = buildMetadata({
  title: "Next Release",
  description: "The previous After Hours Agenda collection is archived. Join the list for the next release.",
  path: "/lookbook",
  robots: { index: false, follow: true },
});

export default function LookbookPage() {
  return (
    <div className="px-4 pb-12 pt-28 sm:px-6 md:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <PageHeader eyebrow="Studio update" title="The next chapter is taking shape" description="The previous campaign is archived with the prior collection. New imagery will arrive with the next release." align="center" />
        <section className="corner-cut crease-rule mt-12 bg-charcoal px-6 py-12 sm:px-10 md:py-16">
          <SheepMark className="mx-auto w-16 text-accent" />
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted md:text-base">There is nothing to shop today. Existing customers can still find order help, and everyone else can get the release announcement first.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/track-order" className="btn-secondary px-6">Track an order</Link><Link href="#newsletter" className="btn-primary px-6">Get release updates</Link></div>
        </section>
      </div>
      <GetOnTheList />
    </div>
  );
}
