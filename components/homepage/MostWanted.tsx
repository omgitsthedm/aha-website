import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function MostWanted({ products, totalProducts }: { products: Product[]; totalProducts: number }) {
  if (products.length === 0) return null;
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 max-w-3xl">
          <div>
            <h2 className="font-display text-[clamp(2.7rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">The design index</h2>
            <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-muted">A fast scan through six graphic ideas. Open any piece for sizes, fit, fabric, care, and delivery details.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-5 lg:grid-cols-6">
          {products.slice(0, 6).map((product, index) => (
            <Link key={product.id} href={`/product/${product.slug}`} className={`group min-w-0 ${index === 0 || index === 5 ? "lg:-translate-y-4" : ""}`}>
              <span className="relative block aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
                {product.images[0] && <Image src={product.images[0]} alt={product.name} fill className={isPrintfulImage(product.images[0]) ? "object-contain transition-transform duration-300 group-hover:scale-[1.025]" : "object-cover transition-transform duration-300 group-hover:scale-[1.025]"} sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 17vw" />}
              </span>
              <span className="mt-3 block break-words font-mono text-xs font-bold leading-snug text-cream group-hover:text-accent">{product.name}</span>
              <span className="mt-1 block font-mono text-xs tabular-nums text-muted">{product.priceFormatted}</span>
            </Link>
          ))}
        </div>
        <Link href="/shop" className="mt-10 inline-flex min-h-11 items-center border border-border/60 px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">Browse all {totalProducts} pieces</Link>
      </div>
    </section>
  );
}
