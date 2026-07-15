import { SheepMark } from "@/components/ui/SheepMark";

/**
 * "After hours, the sign comes on." A neon black-sheep sign — the brand mark as
 * a glowing tube outline over a dusk ground, with the origin line. Pure CSS glow
 * (GPU-composited) + opacity flicker, so it stays smooth on mobile and respects
 * prefers-reduced-motion. `surface="paper"` degrades to a rose line-art version
 * for the light palette (the glow can't read on white — that's the trade-off).
 */
export function NeonBand({ surface = "dark" }: { surface?: "dark" | "paper" }) {
  const paper = surface === "paper";
  return (
    <section
      aria-labelledby="neon-heading"
      className={`relative overflow-hidden px-4 py-20 sm:py-28 ${paper ? "neon-band-paper" : "neon-band"}`}
    >
      <div className="neon-flicker mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="neon-text font-mono text-[10px] font-bold uppercase tracking-[0.35em]">After hours, the sign comes on</p>

        <SheepMark
          outline
          strokeWidth={80}
          title="After Hours Agenda black sheep, in neon"
          className="neon-sheep mt-8 w-[min(70vw,340px)]"
        />

        <h2 id="neon-heading" className="neon-text mt-8 font-display text-[clamp(2.25rem,7vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em]">
          After Hours Agenda
        </h2>
        <p className="neon-text mt-4 font-mono text-xs font-bold uppercase tracking-[0.28em] sm:text-sm">
          Established 2011 · New York City
        </p>
      </div>
    </section>
  );
}
