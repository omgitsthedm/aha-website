import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function LatestDrop({ products, isNewArrivalEdit }: { products: Product[]; isNewArrivalEdit: boolean }) {
  if (products.length === 0) return null;
  const [lead, ...supporting] = products.slice(0, 4);

  return (
    <section className="reveal-block relative z-[2] px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-10 max-w-4xl">
          <h2 className="font-display text-[clamp(3.2rem,6.5vw,6.4rem)] font-bold uppercase leading-[0.8] tracking-[-0.055em]">{isNewArrivalEdit ? "New arrivals" : "In rotation"}</h2>
          <p className="mt-5 max-w-lg font-mono text-sm leading-relaxed text-muted">{isNewArrivalEdit ? "The newest active products, with current sizes and pricing." : "Four current products from the active catalog."}</p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-6">
          <figure className="min-w-0">
            <Link href={`/product/${lead.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-surface">
              {lead.images[0] && <Image src={lead.images[0]} alt={lead.name} fill priority className={`${isPrintfulImage(lead.images[0]) ? "object-contain" : "object-cover"} product-art`} sizes="(max-width: 1024px) 100vw, 66vw" />}
            </Link>
            <figcaption className="grid grid-cols-[1fr_auto] items-start gap-4 border-b border-border/50 py-5">
              <Link href={`/product/${lead.slug}`} className="font-display text-2xl font-bold uppercase leading-[0.9] tracking-[-0.035em] text-cream transition-colors hover:text-accent md:text-4xl">{lead.name}</Link>
              <span className="font-mono text-sm tabular-nums text-muted">{lead.priceFormatted}</span>
            </figcaption>
          </figure>

          <div className="grid content-start gap-7">
            {supporting.map((product) => (
              <Link key={product.id} href={`/product/${product.slug}`} className="group grid grid-cols-[7.5rem_1fr] gap-4 border-b border-border/50 pb-7 transition-colors hover:border-accent sm:grid-cols-[10rem_1fr] lg:grid-cols-[8.5rem_1fr]">
                <span className="relative aspect-[3/4] overflow-hidden bg-surface">
                  {product.images[0] && <Image src={product.images[0]} alt={product.name} fill className={`${isPrintfulImage(product.images[0]) ? "object-contain" : "object-cover"} product-art`} sizes="160px" />}
                </span>
                <span className="flex min-w-0 flex-col justify-between py-1">
                  <span className="break-words font-display text-xl font-bold uppercase leading-[0.9] tracking-[-0.03em] text-cream transition-colors group-hover:text-accent">{product.name}</span>
                  <span className="font-mono text-sm tabular-nums text-muted">{product.priceFormatted}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <Link href={isNewArrivalEdit ? "/new-arrivals" : "/shop"} className="secondary-action mt-10 px-5 py-3 text-xs">{isNewArrivalEdit ? "See every new arrival" : "Shop the active catalog"}</Link>
      </div>
    </section>
  );
}
