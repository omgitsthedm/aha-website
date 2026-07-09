import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/square/catalog";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import type { Product } from "@/lib/utils/types";

export const revalidate = 300;
export const metadata = {
  title: "Lookbook",
  description: "After Hours Agenda editorial — the graphics in the wild. Shop the look.",
};

export default async function LookbookPage() {
  let products: Product[] = [];
  try {
    products = (await getAllProducts()).filter((p) => p.images[0]).slice(0, 18);
  } catch (error) {
    console.error("Failed to load lookbook:", error);
  }

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mosaic-border" />
          <div className="sign-panel-station"><span className="sign-panel-station-text">Lookbook</span></div>
          <div className="mosaic-border" />
          <p className="mt-6 max-w-xl font-body text-base font-bold leading-relaxed text-muted">
            The graphics in the wild. Every piece links straight to its page — see it, then shop it.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="font-body text-sm font-bold text-muted">Lookbook is being shot. Check back soon.</p>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
            {products.map((p, i) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                className="zine-block group relative block break-inside-avoid overflow-hidden"
                style={{ aspectRatio: i % 3 === 0 ? "3 / 4" : i % 3 === 1 ? "1 / 1" : "4 / 5" }}
              >
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  fill
                  unoptimized={isPrintfulImage(p.images[0])}
                  className={`${isPrintfulImage(p.images[0]) ? "object-contain p-6" : "object-cover"} transition-transform duration-500 group-hover:scale-[1.03]`}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-[#10100F] to-transparent p-4 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
                  <span className="font-display text-lg font-black uppercase tracking-[-0.03em] text-cream">{p.name}</span>
                  <span className="font-body text-xs font-bold uppercase tracking-[0.08em] text-[#CCFF00]">Shop →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
