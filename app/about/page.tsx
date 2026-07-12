import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DESIGN_SOURCES } from "@/lib/content/design-sources";

export const metadata = {
  title: "About",
  description: "About After Hours Agenda and how its made-to-order storefront works.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const source = DESIGN_SOURCES[1];

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader title="After Hours Agenda" description="Graphic clothing and objects sold online and produced after an order is placed." />

        <section aria-labelledby="about-heading" className="grid border-y border-border/40 lg:grid-cols-[1.15fr_0.85fr]">
          <Link href={`/product/${source.productSlug}`} data-design-source={source.sourceFile} className="group relative min-h-[30rem] overflow-hidden bg-accent lg:min-h-[44rem]">
            <Image src={source.image} alt={source.alt} fill priority className="object-contain p-8 transition-transform duration-500 group-hover:scale-[1.025] md:p-14" sizes="(max-width: 1024px) 100vw, 58vw" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 border-t border-void/30 bg-void/95 p-4">
              <span className="font-display text-lg font-bold uppercase">{source.title}</span>
              <span className="font-mono text-[11px] font-bold uppercase text-accent">View product</span>
            </span>
          </Link>
          <div className="flex flex-col justify-center border-t border-border/40 p-6 md:p-10 lg:border-l lg:border-t-0 lg:p-14">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">The store</p>
            <h2 id="about-heading" className="mt-5 max-w-3xl font-display text-[clamp(2.8rem,6vw,6rem)] font-bold uppercase leading-[0.82] tracking-[-0.055em]">Built around the work</h2>
            <div className="mt-8 max-w-xl space-y-5 font-mono text-sm leading-relaxed text-muted">
              <p>Original graphics move from the project design library into clothing and objects.</p>
              <p>Products are made to order. Production usually takes 2-5 business days before carrier transit begins.</p>
              <p>Each product page shows current price, sizing, care, production, shipping, and return information.</p>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Shop all products</Link>
              <Link href="/lookbook" className="secondary-action min-h-11 px-5 py-3 text-xs">View design files</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="orders-heading" className="grid gap-10 py-20 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="orders-heading" className="max-w-4xl font-display text-[clamp(2.8rem,7vw,6.5rem)] font-bold uppercase leading-[0.82] tracking-[-0.055em]">Before you order</h2>
          <dl className="border-t border-border/40">
            {[
              ["01 / Production", "Products are printed after purchase. The estimated production window is shown before checkout."],
              ["02 / Shipping", "Standard shipping is included. Tracking is provided when the carrier receives the order."],
              ["03 / Returns", "Review the return policy and product-specific sizing before purchasing."],
            ].map(([title, body]) => (
              <div key={title} className="grid gap-3 border-b border-border/40 py-6 md:grid-cols-[12rem_1fr]">
                <dt className="font-display text-xl font-bold uppercase tracking-[-0.025em]">{title}</dt>
                <dd className="max-w-lg font-mono text-sm leading-relaxed text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
