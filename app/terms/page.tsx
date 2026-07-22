import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";

export const metadata = { title: "Storefront Terms of Service", description: "Read the After Hours Agenda terms for made-to-order products, pricing, Square payments, shipping, returns, intellectual property, site use, and support.", alternates: { canonical: "/terms" } };

const sections = [
  ["Orders", "Products are made to order. An order is accepted when payment is approved and the storefront issues a confirmation. We may cancel and refund an order when a product, price, payment, address, fraud, or fulfillment issue prevents safe completion."],
  ["Pricing and payment", "Prices are shown in USD. Tax and the final order total are calculated before payment. Payments are processed through Square."],
  ["Products", "Product images and colors can appear differently across screens. Garment measurements may vary slightly by blank and production batch. Product-specific details take priority over general site guidance."],
  ["Production", "Production normally begins after payment. Published production and delivery windows are estimates rather than guaranteed arrival dates. Delays may occur because of carrier conditions, destination, customs, demand, weather, or an address issue."],
  ["Shipping and returns", "Current production, shipping, and return terms are described on the Shipping and Returns pages. We cover return shipping on eligible returns. Made-to-order production costs may be non-refundable after printing begins. Confirmed defects, damage, and incorrect items are reviewed separately."],
  ["Cancellations and refunds", "Contact support immediately to request a cancellation or correction. A change is not guaranteed after production begins. Approved refunds return through the original Square payment path; bank processing time can vary."],
  ["Intellectual property", "The After Hours Agenda name, marks, graphics, photography, and site content may not be copied or distributed without permission, except where applicable law allows."],
  ["Site use", "Do not misuse the site, interfere with its operation, attempt unauthorized access, or submit fraudulent orders. We may restrict access when needed to protect customers or the store."],
  ["Contact", `Questions about these terms can be sent to ${SUPPORT_EMAIL}. Never send card details, passwords, or account credentials by email.`],
];

export default function TermsPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated July 12, 2026" title="Terms of service" description="These terms govern use of the After Hours Agenda storefront and purchases placed through it." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
