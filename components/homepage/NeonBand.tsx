import { NeonSheep } from "@/components/brand/NeonSheep";

/**
 * "After hours, the sign comes on." A photographed-neon black-sheep sign on the
 * paper ground: a thick rose GLASS TUBE + a lighter lit CORE + a faint colored
 * haze + a plexiglass gloss sweep. Pure CSS (stacked SVG layers + shadows) —
 * GPU-composited, smooth on mobile, and respects prefers-reduced-motion.
 */
export function NeonBand() {
  return (
    <section aria-labelledby="neon-heading" className="neon-sign relative overflow-hidden bg-void px-4 py-20 sm:py-28">
      <div className="neon-flicker mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="neon2-text font-mono text-[10px] font-bold uppercase tracking-[0.35em]">After hours, the sign comes on</p>
        <NeonSheep className="mt-8 h-[min(72vw,360px)] w-[min(72vw,360px)]" />
        <h2 id="neon-heading" className="neon2-text mt-8 font-display text-[clamp(2.25rem,7vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em]">
          After Hours Agenda
        </h2>
        <p className="neon2-text mt-4 font-mono text-xs font-bold uppercase tracking-[0.28em] sm:text-sm">
          Established 2011 · New York City
        </p>
      </div>
    </section>
  );
}
