import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadSizeGuides } from "@/lib/data/products";

export const metadata = { title: "Apparel Size Guide", description: "How After Hours Agenda sizing works: products that come in more than one size carry the manufacturer's own measurements on the product page, plus general fit notes and how to measure.", alternates: { canonical: "/size-guide" } };

// The blanks behind the catalog do not share a measurement chart, so a single static
// table on this page was wrong for most products. Exact numbers now come from one
// place only — the per-product "Size guide" on the PDP, which loads the manufacturer's
// own garment measurements for the variant being viewed. This page explains how to
// read them and carries the general fit note for each product type, sourced from the
// same dataset the PDP uses so the two surfaces cannot drift apart.
const TYPE_LABELS: Record<string, string> = {
  tee: "T-shirts",
  sweater: "Sweatshirts",
  hoodie: "Hoodies",
  accessory: "Accessories",
  other: "Everything else",
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

export default function SizeGuidePage() {
  const guides = loadSizeGuides()
    .filter((guide) => guide.fit)
    .sort((a, b) => TYPE_ORDER.indexOf(a.productType) - TYPE_ORDER.indexOf(b.productType));

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Fit reference" title="Size guide" description="Exact measurements live on the product page, because the garment blanks are not all cut the same. Open Size guide beside the size options on any product that comes in more than one size and you get that garment's own chart." />
      <dl className="border-t border-border/40">
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Where the numbers are</dt><dd className="text-sm leading-relaxed text-muted">Any product that comes in more than one size has a <strong className="text-cream">Size guide</strong> control beside the size options. It shows the manufacturer&rsquo;s measurements for that specific garment, along with its fit and care notes. Where a piece is sold in a single size there is no chart, and the fit note on the product page covers it instead. <Link href="/shop" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Browse the shop</Link></dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">How to read them</dt><dd className="text-sm leading-relaxed text-muted">Measurements are of the <strong className="text-cream">garment, laid flat</strong> — not of your body. Chest is measured across the garment from armpit to armpit; length runs from the highest point of the shoulder straight down to the hem. Units are shown at the top of each chart.</dd></div>
        <div className="grid gap-3 border-b border-border/40 py-7 md:grid-cols-[12rem_1fr]"><dt className="font-display text-xl font-bold uppercase">Choosing a size</dt><dd className="text-sm leading-relaxed text-muted">The most reliable method is to lay flat a piece you already own and like the fit of, measure it the same way, and match it to the chart. Product-specific fit notes take priority over anything general on this page.</dd></div>
      </dl>

      <section className="mt-12">
        <h2 className="font-display text-xl font-black uppercase">General fit by product type</h2>
        <dl className="mt-4 border-t border-border/40">
          {guides.map((guide) => (
            <div key={guide.id} className="grid gap-1 border-b border-border/40 py-5 md:grid-cols-[12rem_1fr] md:gap-3">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-cream">{TYPE_LABELS[guide.productType] ?? guide.productType}</dt>
              <dd className="text-sm leading-relaxed text-muted">{guide.fit}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 border-l-2 border-accent pl-4"><p className="text-sm leading-relaxed text-muted">Still not sure? <Link href="/contact" className="text-accent underline underline-offset-4">Contact support</Link> with the product name and the measurements of a piece that already fits you.</p></div>
    </div></div>
  );
}
