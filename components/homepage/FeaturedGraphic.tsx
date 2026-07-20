import { ResilientImage } from "@/components/ui/ResilientImage";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

/**
 * Featured-graphic spotlight — AHA's version of a campaign: one design shown big
 * as artwork with its story. Celebrates the graphic (the real content) instead
 * of burying it in a grid. Reveals + hover life; no lifestyle photography needed.
 */
export function FeaturedGraphic({ product, eyebrow, story }: { product: Product; eyebrow: string; story: string }) {
  const image = product.images[0];
  return (
    <section aria-labelledby="spotlight-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Link href={`/product/${product.slug}`} className="fold-surface paper-lift image-hover-zoom group relative block aspect-square overflow-hidden">
          {image && (
            <ResilientImage src={image} alt={product.name} fill className={`${isPrintfulImage(image) ? "object-contain" : "object-cover"} p-8 product-art`} sizes="(max-width: 1024px) 100vw, 50vw" />
          )}
        </Link>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">{eyebrow}</p>
          <h2 id="spotlight-heading" className="mt-3 font-display text-[clamp(2.25rem,6vw,4rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-cream">
            {product.name}
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted">{story}</p>
          <div className="mt-8">
            <Link href={`/product/${product.slug}`} className="btn-primary">View piece · {product.priceFormatted}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
