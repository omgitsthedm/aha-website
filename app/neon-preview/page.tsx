import { NeonBand } from "@/components/homepage/NeonBand";

// TEMPORARY preview to compare neon treatments. Remove after the choice is made.
export const metadata = { title: "Neon preview", robots: { index: false, follow: false } };

export default function NeonPreviewPage() {
  return (
    <div className="pt-24">
      <p className="px-4 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">A — Neon on dusk (recommended)</p>
      <NeonBand surface="dark" />
      <p className="px-4 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">B — Rose line-art on paper (glow can’t read on white)</p>
      <NeonBand surface="paper" />
    </div>
  );
}
