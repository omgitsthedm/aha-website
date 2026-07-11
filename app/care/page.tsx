import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Care Instructions", description: "General care guidance for After Hours Agenda printed apparel.", alternates: { canonical: "/care" } };

const care = [
  ["01", "Wash cold", "Machine wash with like colors. Cold water helps protect both print and fabric."],
  ["02", "Turn inside out", "Reverse the garment before washing to reduce friction against the print."],
  ["03", "Use low heat", "Tumble dry low or air dry. High heat can damage prints and shrink fabric."],
  ["04", "Keep irons off print", "If ironing is needed, use low heat from the inside and avoid the printed area."],
  ["05", "Skip bleach", "Bleach and harsh chemicals can damage the fabric and print."],
  ["06", "Skip dry cleaning", "Dry-cleaning chemicals may damage direct-to-garment prints."],
];

export default function CarePage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="General guidance" title="Care for the print" description="Follow the product label when it differs from this general guidance." /><ol className="border-t border-border/40">{care.map(([number, title, detail]) => <li key={number} className="grid gap-3 border-b border-border/40 py-6 sm:grid-cols-[3rem_12rem_1fr]"><span className="font-mono text-sm font-bold text-accent">{number}</span><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{detail}</p></li>)}</ol></div></div>;
}
