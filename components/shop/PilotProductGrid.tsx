import Image from "next/image";
import Link from "next/link";
import { getPilotEdition } from "@/lib/data/pilot-assortment";
import type { Product } from "@/lib/utils/types";

export function PilotProductGrid({ products, headingLevel = 2 }: { products: Product[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <div className="grid gap-y-12 md:grid-cols-12 md:gap-x-6 md:gap-y-16">
      {products.map((product, index) => (
        <Link
          key={product.id}
          href={`/product/${product.slug}`}
          className={`fold-enter group block focus-visible:outline-offset-4 ${
            index === 0 ? "md:col-span-7" : index === 1 ? "md:col-span-5 md:mt-20" : "md:col-span-6 md:col-start-7"
          }`}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className={`fold-surface relative overflow-hidden ${index === 0 ? "aspect-[5/6]" : "aspect-[4/5]"}`}>
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              priority={index === 0}
              className="pointer-events-none product-art object-contain p-3 sm:p-5"
              sizes="(max-width: 767px) 100vw, 33vw"
            />
            <span className="absolute left-3 top-3 border border-border/50 bg-void px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              0{index + 1} / 03
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border/40 py-4 transition-colors group-hover:border-accent">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent">{getPilotEdition(product.slug)}</p>
              <Heading className="mt-2 font-display text-2xl font-bold uppercase leading-[0.9] tracking-[-0.035em] text-cream transition-colors group-hover:text-accent">
                {product.name}
              </Heading>
            </div>
            <p className="font-mono text-sm font-bold text-cream">{product.priceFormatted}</p>
          </div>
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted group-hover:text-accent">
            View product →
          </p>
        </Link>
      ))}
    </div>
  );
}
