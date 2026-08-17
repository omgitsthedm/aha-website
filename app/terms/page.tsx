import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({
  title: "Site and Existing-Order Terms",
  description: "Terms for using the After Hours Agenda site and getting support for orders placed before the catalog reset.",
  path: "/terms",
});

const sections = [
  ["Catalog status", "The prior product catalog is archived, and the site is not accepting new product or gift-card orders while the next collection is developed. Release updates do not create a purchase or reservation."],
  ["Existing orders", "Orders placed before the catalog reset remain supported under the terms and product information shown when they were purchased. Keep the order number and checkout email available when contacting support."],
  ["Shipping and returns", "The Shipping and Returns pages explain how to request help for an existing order. Eligibility, timing, and available remedies are reviewed against the terms that applied when the order was placed."],
  ["Payments and refunds", "Prior payments were processed through Square. Approved refunds return through the original payment path; bank processing time can vary. Never send card details by email."],
  ["Intellectual property", "The After Hours Agenda name, marks, graphics, photography, and site content may not be copied or distributed without permission, except where applicable law allows."],
  ["Site use", "Do not misuse the site, interfere with its operation, attempt unauthorized access, or submit fraudulent information. We may restrict access when needed to protect visitors, customers, or the site."],
  ["Contact", `Questions about these terms can be sent to ${SUPPORT_EMAIL}. Never send card details, passwords, or account credentials by email.`],
];

export default function TermsPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated August 17, 2026" title="Terms of service" description="These terms cover the current site and support for orders placed before the catalog reset. New sales are paused." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
