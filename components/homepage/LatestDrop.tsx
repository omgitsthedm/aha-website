import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function LatestDrop({ products, isNewArrivalEdit }: { products: Product[]; isNewArrivalEdit: boolean }) {
  if (products.length === 0) return null;
  const [lead, ...supporting] = products.slice(0, 5);
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-9 max-w-3xl">
          <h2 className="font-display text-[clamp(2.7rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">{isNewArrivalEdit ? "New arrivals" : "Current rotation"}</h2>
          <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-muted">{isNewArrivalEdit ? "Fresh additions to the active catalog." : "Five pieces pulled forward from the full catalog."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-2 md:gap-5">
          <Link href={`/product/${lead.slug}`} className="group md:col-span-7 md:row-span-2">
            <div className="relative aspect-[4/5] overflow-hidden border border-border/40 bg-surface md:h-full md:aspect-auto">
              {lead.images[0] && <Image src={lead.images[0]} alt={lead.name} fill priority className={isPrintfulImage(lead.images[0]) ? "object-contain transition-transform duration-300 group-hover:scale-[1.015]" : "object-cover transition-transform duration-300 group-hover:scale-[1.015]"} sizes="(max-width: 768px) 100vw, 58vw" />}
              <div className="absolute inset-x-0 bottom-0 border-t border-border/50 bg-void/95 p-4 md:p-5">
                <h3 className="font-display text-xl font-black uppercase leading-none tracking-[-0.04em] text-cream group-hover:text-accent md:text-3xl">{lead.name}</h3>
                <p className="mt-2 font-mono text-sm tabular-nums text-muted">{lead.priceFormatted}</p>
              </div>
            </div>
          </Link>
          {supporting.map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="group md:col-span-5">
              <div className="grid h-full min-h-36 grid-cols-[7.5rem_1fr] border border-border/40 bg-charcoal sm:grid-cols-[10rem_1fr]">
                <div className="relative bg-surface">
                  {product.images[0] && <Image src={product.images[0]} alt={product.name} fill className={isPrintfulImage(product.images[0]) ? "object-contain" : "object-cover"} sizes="160px" />}
                </div>
                <div className="flex min-w-0 flex-col justify-between p-4">
                  <h3 className="break-words font-display text-lg font-black uppercase leading-[0.95] tracking-[-0.035em] text-cream group-hover:text-accent">{product.name}</h3>
                  <p className="mt-4 font-mono text-sm tabular-nums text-muted">{product.priceFormatted}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Link href={isNewArrivalEdit ? "/new-arrivals" : "/shop"} className="mt-8 inline-flex min-h-11 items-center border border-border/60 px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">{isNewArrivalEdit ? "Browse new arrivals" : "Shop the full catalog"}</Link>
      </div>
    </section>
  );
}
