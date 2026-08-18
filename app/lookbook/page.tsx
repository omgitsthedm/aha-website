import Link from "next/link";
import { EditorialPicture } from "@/components/ui/EditorialPicture";
import Image from "next/image";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { loadBrandImagery } from "@/lib/content/brand-imagery";

export const metadata = buildMetadata({
  title: "Lookbook",
  description: "The After Hours Agenda collection, worn by the people it was made for — graphic tees, heavyweight hoods and crewnecks, made to order.",
  path: "/lookbook",
});

export default function LookbookPage() {
  const { lookbook, lookbookCover } = loadBrandImagery();

  return (
    <div className="pb-12">
      <section aria-label="Lookbook cover" className="relative isolate min-h-[60vh] overflow-hidden bg-[#0b0b0c] text-white">
        <EditorialPicture src={lookbookCover.src} alt={lookbookCover.alt} priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-[1280px] flex-col justify-end px-4 pb-12 pt-32 sm:px-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/80">Lookbook · The collection, worn</p>
          <h1 className="editorial-title mt-4 text-[clamp(2.75rem,7vw,6rem)] text-white">Worn by <em>good people</em></h1>
        </div>
      </section>

      <section aria-label="Lookbook" className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-6 lg:pt-16">
        <PageHeader eyebrow="The collection" title="Eight graphics. One cut. Everyone welcome." description="For the dreamers and the doers — and for the people they buy for. Made to order, one at a time. Tap any frame to see the piece." />
        <div className="mt-10 columns-2 gap-3 md:columns-3 md:gap-4 [&>*]:mb-3 md:[&>*]:mb-4">
          {lookbook.map((shot, index) => {
            const wide = shot.aspect === "16:9";
            const frame = (
              <>
                <div className={`frame relative overflow-hidden ${wide ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
                  <Image src={shot.src} alt={shot.alt} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
                </div>
                {shot.caption && (
                  <p className="mt-2 flex items-baseline justify-between gap-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted">
                    <span>{shot.caption}</span>
                    {shot.productSlug && <span className="text-accent">View piece →</span>}
                  </p>
                )}
              </>
            );
            return shot.productSlug ? (
              <Link key={shot.src + index} href={`/product/${shot.productSlug}`} className="frame image-hover-zoom group block break-inside-avoid focus-visible:outline-offset-4">
                {frame}
              </Link>
            ) : (
              <figure key={shot.src + index} className="break-inside-avoid">{frame}</figure>
            );
          })}
        </div>
        {/* The ending. The last thing on the page is the line, not a grid edge. */}
        <div className="mt-16 border-t border-border/40 pt-12 lg:mt-20">
          <p className="editorial-title max-w-4xl text-[clamp(2rem,5vw,4.5rem)] text-cream">Made for you, <em>and the people you love.</em></p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/shop" className="btn-primary px-7">Shop the collection</Link>
            <Link href="/about" className="btn-secondary px-7">Our story</Link>
          </div>
        </div>
      </section>

      <GetOnTheList />
    </div>
  );
}
