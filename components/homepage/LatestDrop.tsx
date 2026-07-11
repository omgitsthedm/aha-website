import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function LatestDrop({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-2xl border-t-2 border-accent pt-5">
          <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">New arrivals</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted">The latest pieces ready to choose, size, and order.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.slice(0, 4).map((product, index) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="group focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <div className="relative aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
                {product.images[0] && <Image src={product.images[0]} alt={product.name} fill priority={index < 2} className={isPrintfulImage(product.images[0]) ? "object-contain" : "object-cover"} sizes="(max-width: 768px) 50vw, 25vw" />}
              </div>
              <div className="pt-3">
                <h3 className="font-mono text-sm font-bold leading-snug text-cream group-hover:text-accent">{product.name}</h3>
                <p className="mt-1 font-mono text-sm tabular-nums text-muted">{product.priceFormatted}</p>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/new-arrivals" className="mt-10 inline-flex min-h-11 items-center border border-border/60 px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">Browse new arrivals</Link>
      </div>
    </section>
  );
}
