import Link from "next/link";
import Image from "next/image";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { loadBrandImagery } from "@/lib/content/brand-imagery";

export const metadata = buildMetadata({
  title: "Lookbook",
  description: "The After Hours Agenda collection, worn in New York after hours — graphic tees, heavyweight hoods and crewnecks, printed to order.",
  path: "/lookbook",
});

export default function LookbookPage() {
  const { lookbook, hero } = loadBrandImagery();

  return (
    <div className="pb-12">
      <section aria-label="Lookbook cover" className="relative isolate min-h-[60vh] overflow-hidden bg-[#0b0b0c] text-white">
        <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-[1280px] flex-col justify-end px-4 pb-12 pt-32 sm:px-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-rose">Lookbook · New York · After hours</p>
          <h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,6.5rem)] font-black uppercase leading-[0.86] tracking-[-0.05em]">Worn like you mean it</h1>
        </div>
      </section>

      <section aria-label="Lookbook" className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-6 lg:pt-16">
        <PageHeader eyebrow="The collection, out in the city" title="Eight graphics. One cut. Every hour after five." description="Drawn on the last train and the kitchen table, printed one at a time when you order. Tap any frame to see the piece." />
        <div className="mt-10 columns-2 gap-3 md:columns-3 md:gap-4 [&>*]:mb-3 md:[&>*]:mb-4">
          {lookbook.map((shot, index) => {
            const wide = shot.aspect === "16:9";
            const frame = (
              <>
                <div className={`frame relative overflow-hidden ${wide ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
                  <Image src={shot.src} alt={shot.alt} fill loading={index < 2 ? "eager" : "lazy"} className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
                </div>
                {shot.caption && (
                  <p className="mt-2 flex items-baseline justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
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
        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/shop" className="btn-primary px-7">Shop the collection</Link>
          <Link href="/about" className="btn-secondary px-7">The story since 2011</Link>
        </div>
      </section>

      <GetOnTheList />
    </div>
  );
}
