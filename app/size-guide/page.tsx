import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { loadProducts, loadSizeGuides } from "@/lib/data/products";
import { SELLABLE_PRODUCT_SLUGS } from "@/lib/commerce/sellable-slugs.generated";

export const metadata = buildMetadata({
  title: "Size Guide",
  description: "Garment measurements for After Hours Agenda tees, heavyweight hoods and crewnecks — chest width and body length by size.",
  path: "/size-guide",
});

const GUIDE_TITLES: Record<string, string> = {
  "sg-tee": "Tees",
  "sg-hoodie": "Hoods",
  "sg-crewneck": "Crewnecks",
};

export default function SizeGuidePage() {
  // Only guides that a sellable product actually points at, so the page can
  // never describe a garment that is not for sale.
  const inUse = new Set(
    loadProducts()
      .filter((product) => SELLABLE_PRODUCT_SLUGS.has(product.slug))
      .map((product) => product.sizeGuideId),
  );
  const guides = loadSizeGuides().filter((guide) => inUse.has(guide.id) && guide.measurements.length > 0);

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Size guide" title="Find your size" description="Measurements are of the garment, laid flat, in inches, straight from the blank's manufacturer. Compare them with a piece you already wear — that beats any chart." />
      {guides.map((guide) => (
        <section key={guide.id} aria-labelledby={`${guide.id}-heading`} className="mt-12 border-t border-border/40 pt-8">
          <h2 id={`${guide.id}-heading`} className="font-display text-2xl font-bold uppercase tracking-[-0.03em] text-cream">{GUIDE_TITLES[guide.id] ?? guide.id}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{guide.fit}{guide.note ? ` ${guide.note}` : ""}</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-border/40 py-2 pr-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Size</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Chest width</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Body length</th>
                </tr>
              </thead>
              <tbody>
                {guide.measurements.map((row) => (
                  <tr key={row.size}>
                    <th scope="row" className="border-b border-border/20 py-2 pr-3 font-display font-bold uppercase text-cream">{row.size}</th>
                    <td className="border-b border-border/20 px-2 py-2 font-mono text-cream/85">{row.chestIn ?? "—"}</td>
                    <td className="border-b border-border/20 px-2 py-2 font-mono text-cream/85">{row.lengthIn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {guide.howToMeasure && <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">{guide.howToMeasure}</p>}
          {guide.sizeUpIf && <p className="mt-1 text-xs leading-relaxed text-muted">Size up if: {guide.sizeUpIf}</p>}
          {guide.sizeDownIf && <p className="mt-1 text-xs leading-relaxed text-muted">Size down if: {guide.sizeDownIf}</p>}
        </section>
      ))}
      <section className="mt-12 border-y border-border/40 py-8"><p className="max-w-2xl text-sm leading-relaxed text-muted">Still unsure? <Link href="/contact" className="text-accent underline underline-offset-4">Contact support</Link> with your usual size and the piece you are looking at, or <Link href="/shop" className="text-accent underline underline-offset-4">shop the collection</Link>.</p></section>
    </div></div>
  );
}
