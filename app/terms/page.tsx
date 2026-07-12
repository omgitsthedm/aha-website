import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Storefront Terms of Service", description: "Read the After Hours Agenda terms for made-to-order products, pricing, Square payments, shipping, returns, intellectual property, site use, and support.", alternates: { canonical: "/terms" } };

const sections = [
  ["Orders", "Products are made to order. An order is accepted when payment is approved and the storefront issues a confirmation. We may cancel and refund an order if a product, price, payment, or fulfillment error prevents completion."],
  ["Pricing and payment", "Prices are shown in USD. Tax and the final order total are calculated before payment. Payments are processed through Square."],
  ["Products", "Product images and colors can appear differently across screens. Garment measurements may vary slightly by blank and production batch. Product-specific details take priority over general site guidance."],
  ["Shipping and returns", "Production, shipping, and return terms are described on the Shipping and Returns pages. Made-to-order production fees may be non-refundable after printing begins."],
  ["Intellectual property", "The After Hours Agenda name, marks, graphics, photography, and site content may not be copied or distributed without permission, except where applicable law allows."],
  ["Site use", "Do not misuse the site, interfere with its operation, attempt unauthorized access, or submit fraudulent orders. We may restrict access when needed to protect customers or the store."],
  ["Contact", "Questions about these terms can be sent to hello@afterhoursagenda.com."],
];

export default function TermsPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated July 10, 2026" title="Terms of service" description="These terms govern use of the storefront and purchases from After Hours Agenda." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
