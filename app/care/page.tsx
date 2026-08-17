import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Existing Item Care",
  description: "General care support for items from completed After Hours Agenda orders.",
  path: "/care",
});

const care = [
  ["01", "Read the label", "The garment label is the source of truth for the item you received."],
  ["02", "Wash gently", "Cold water and like colors are a safe starting point when the label allows machine washing."],
  ["03", "Use low heat", "Air drying or low heat can help protect fabric and printed surfaces when the label permits it."],
  ["04", "Ask when unsure", "Contact support with the order number and a photo of the label for help with a specific completed order."],
] as const;

export default function CarePage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="Existing-order support" title="Care guidance" description="The prior collection is archived. This general guidance is for items already received." /><ol className="border-t border-border/40">{care.map(([number, title, detail]) => <li key={number} className="grid gap-3 border-b border-border/40 py-6 sm:grid-cols-[3rem_12rem_1fr]"><span className="font-mono text-sm font-bold text-accent">{number}</span><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{detail}</p></li>)}</ol></div></div>;
}
