import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Privacy Policy", description: "Privacy policy for After Hours Agenda.", alternates: { canonical: "/privacy" } };

const sections = [
  ["Information we collect", "We collect information you provide during checkout or support, including your name, email address, shipping address, order details, and messages. Payment details are handled by Square rather than stored by this storefront."],
  ["How we use it", "We use information to quote, process, produce, ship, and support orders; send transactional updates; operate the storefront; prevent abuse; and improve the customer experience."],
  ["Service providers", "Information is shared only when needed to operate the store, including with Square for payments and Printful for production and fulfillment. Their own privacy terms also apply."],
  ["Marketing", "Newsletter email is collected only when you submit the signup form. You may unsubscribe from marketing messages using the link in an email or by contacting us."],
  ["Your choices", "To ask about access, correction, or deletion of personal information, email hello@afterhoursagenda.com. Some order records may need to be retained for legal, fraud-prevention, or accounting reasons."],
];

export default function PrivacyPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated July 10, 2026" title="Privacy policy" description="This policy explains the information used to operate the After Hours Agenda storefront and fulfill orders." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
