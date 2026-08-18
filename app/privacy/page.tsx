import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({ title: "Privacy Policy", description: "What After Hours Agenda collects for release updates, site operation, and existing-order support, plus how to request access or deletion.", path: "/privacy" });

const sections = [
  ["Information we collect", "We collect information you submit for release updates or support, such as your email address and messages. For orders placed before the catalog reset, historical records may also include a name, shipping address, order details, and payment status. This site does not store complete card details."],
  ["How we use it", "We use information to send messages you request, operate and secure the site, support existing orders, prevent abuse, and meet accounting or legal obligations. The site is not accepting new orders while the catalog is reset."],
  // Apliiq is disclosed before it processes anything, not after. Order
  // submission is still gated off, but lib/apliiq/orders.ts sends the recipient
  // name and full shipping address with every order the moment those gates
  // flip, and a sub-processor has to be listed before that first transfer.
  // Printful stays listed: it fulfilled real orders and those records exist, so
  // removing it would misstate the history rather than correct it.
  ["Service providers (sub-processors)", "Information is shared only as needed for site operation, order fulfillment, and existing-order support. This can include Square for payments, Apliiq for made-to-order production and fulfillment, Printful for fulfillment of orders placed before the catalog reset, Netlify for hosting, Neon for the operational database, and Resend for email. A fulfillment provider receives the recipient name, shipping address, and item details required to produce and ship an order from its own facility. With your consent, analytics and advertising providers may also process data as described below. Provider privacy terms apply."],
  ["Analytics and advertising", "With your consent, we use Google Analytics to measure site traffic, and the Meta (Facebook/Instagram) and TikTok pixels to measure and improve advertising. These set cookies and load ONLY after you accept in the cookie banner — decline and they never run. You can change your choice anytime via “Do Not Sell or Share My Info” in the footer."],
  ["Order records", "Order, payment-status, fulfillment, shipment, webhook, and support records may be retained to deliver service, prevent duplicate processing, resolve disputes, meet accounting obligations, and protect the store and its customers. Records are kept only as long as needed for those purposes."],
  ["Marketing", "Newsletter email is collected only when you submit the signup form. You may unsubscribe from marketing messages using the link in an email or by contacting us."],
  ["Cookies and consent", "Essential storage supports site preferences and protected features. Non-essential analytics and advertising cookies load only after you accept them in the cookie banner. You can change or withdraw consent anytime from the footer."],
  ["Global Privacy Control", "If your browser sends a Global Privacy Control signal, the site treats it as an opt-out. Optional analytics and advertising remain off while that signal is active, even if a prior stored choice allowed them."],
  ["Your choices", `To ask about access, correction, or deletion of personal information, email ${SUPPORT_EMAIL}. Some order records may need to be retained for legal, fraud-prevention, dispute, or accounting reasons.`],
  ["California privacy rights", `If you are a California resident, you may opt out of the “sale” or “sharing” of personal information for cross-context behavioral advertising by declining cookies in the banner or using “Do Not Sell or Share My Info” in the footer, and you may request access to or deletion of your information by emailing ${SUPPORT_EMAIL}. We do not discriminate against you for exercising these rights.`],
  ["Security and limits", "We use service providers and technical controls intended to protect site and order data, but no online system can promise absolute security. Never send card details, passwords, or account credentials through support email."],
];

export default function PrivacyPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated August 17, 2026" title="Privacy policy" description="This policy explains the information used to operate the current site, support existing orders, and send messages you request." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
