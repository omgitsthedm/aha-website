import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Apparel Size Guide", description: "Compare general chest and length measurements for After Hours Agenda unisex T-shirts, sweatshirts, and hoodies before choosing a product size.", alternates: { canonical: "/size-guide" } };

const tables = [
  { title: "Unisex T-shirts", rows: [["S", "34-36", "27"], ["M", "38-40", "28"], ["L", "42-44", "29"], ["XL", "46-48", "30"], ["2XL", "50-52", "31"]] },
  { title: "Sweatshirts and hoodies", rows: [["S", "36-38", "26"], ["M", "40-42", "27"], ["L", "44-46", "28"], ["XL", "48-50", "29"], ["2XL", "52-54", "30"]] },
];

export default function SizeGuidePage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-4xl"><PageHeader eyebrow="General reference" title="Size guide" description="Product-specific fit notes take priority. Measurements are in inches and can vary slightly by garment blank." /><div className="grid gap-10 md:grid-cols-2">{tables.map((table) => <section key={table.title}><h2 className="mb-4 font-display text-xl font-black uppercase">{table.title}</h2><div className="overflow-x-auto border-t border-border/40"><table className="w-full min-w-[22rem] text-left text-sm"><caption className="sr-only">{table.title} measurements in inches</caption><thead className="text-xs uppercase tracking-[0.06em] text-muted"><tr className="border-b border-border/40"><th scope="col" className="py-3 pr-4">Size</th><th scope="col" className="py-3 pr-4">Chest</th><th scope="col" className="py-3">Length</th></tr></thead><tbody>{table.rows.map(([size, chest, length]) => <tr key={size} className="border-b border-border/40"><th scope="row" className="py-3 pr-4 font-bold text-cream">{size}</th><td className="py-3 pr-4 text-muted">{chest}</td><td className="py-3 text-muted">{length}</td></tr>)}</tbody></table></div></section>)}</div></div></div>;
}
