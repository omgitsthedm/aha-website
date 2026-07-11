import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function MostWanted({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 border-t-2 border-accent pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">The catalog edit</h2>
            <p className="mt-3 font-mono text-sm text-muted">Six pieces selected from the current catalog.</p>
          </div>
          <Link href="/shop" className="inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase text-accent underline underline-offset-4">Shop all products</Link>
        </div>

        <div className="grid border-t border-border/40 md:grid-cols-2">
          {products.slice(0, 6).map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="group grid min-h-28 grid-cols-[88px_1fr_auto] items-center gap-4 border-b border-border/40 py-4 md:odd:border-r md:odd:pr-5 md:even:pl-5">
              <span className="relative block aspect-square overflow-hidden bg-surface">
                {product.images[0] && <Image src={product.images[0]} alt="" fill className={isPrintfulImage(product.images[0]) ? "object-contain" : "object-cover"} sizes="88px" />}
              </span>
              <span className="font-mono text-sm font-bold leading-snug text-cream group-hover:text-accent">{product.name}</span>
              <span className="font-mono text-sm tabular-nums text-muted">{product.priceFormatted}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
