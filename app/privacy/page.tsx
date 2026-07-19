import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";

export const metadata = { title: "Storefront Privacy Policy", description: "What After Hours Agenda collects for checkout and support, how Square and Printful process order data, and how to request access or deletion.", alternates: { canonical: "/privacy" } };

const sections = [
  ["Information we collect", "We collect information you provide during checkout or support, including your name, email address, shipping address, order details, and messages. Payment details are handled by Square rather than stored by this storefront."],
  ["How we use it", "We use information to quote, process, produce, ship, and support orders; send transactional updates; operate the storefront; prevent abuse; and improve the customer experience."],
  ["Service providers (sub-processors)", "Information is shared only as needed to operate the store: Square (payments), Printful (production + shipping), Netlify (hosting), Neon (operational database), and Resend (transactional email). With your consent, analytics and advertising providers also process data (see below). Each provider's own privacy terms apply."],
  ["Analytics and advertising", "With your consent, we use Google Analytics to measure site traffic, and the Meta (Facebook/Instagram) and TikTok pixels to measure and improve advertising. These set cookies and load ONLY after you accept in the cookie banner — decline and they never run. You can change your choice anytime via “Do Not Sell or Share My Info” in the footer."],
  ["Order records", "Order, payment-status, fulfillment, shipment, webhook, and support records may be retained to deliver service, prevent duplicate processing, resolve disputes, meet accounting obligations, and protect the store and its customers. Records are kept only as long as needed for those purposes."],
  ["Marketing", "Newsletter email is collected only when you submit the signup form. You may unsubscribe from marketing messages using the link in an email or by contacting us."],
  ["Cookies and consent", "Essential storage keeps your bag between visits and runs checkout and protected features — these are always on. Non-essential analytics and advertising cookies load only after you accept them in the cookie banner. You can change or withdraw consent anytime from the footer."],
  ["Your choices", `To ask about access, correction, or deletion of personal information, email ${SUPPORT_EMAIL}. Some order records may need to be retained for legal, fraud-prevention, dispute, or accounting reasons.`],
  ["California privacy rights", `If you are a California resident, you may opt out of the “sale” or “sharing” of personal information for cross-context behavioral advertising by declining cookies in the banner or using “Do Not Sell or Share My Info” in the footer, and you may request access to or deletion of your information by emailing ${SUPPORT_EMAIL}. We do not discriminate against you for exercising these rights.`],
  ["Security and limits", "We use service providers and technical controls intended to protect storefront data, but no online system can promise absolute security. Never send card details, passwords, or account credentials through support email."],
];

export default function PrivacyPage() {
  return <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32"><article className="mx-auto max-w-4xl"><PageHeader eyebrow="Last updated July 14, 2026" title="Privacy policy" description="This policy explains the information used to run the storefront, process and fulfill orders, provide support, and send messages you request." /><div className="divide-y divide-border/40 border-y border-border/40">{sections.map(([title, body]) => <section key={title} className="grid gap-3 py-7 md:grid-cols-[13rem_1fr] md:gap-8"><h2 className="font-display text-lg font-black uppercase">{title}</h2><p className="text-sm leading-relaxed text-muted">{body}</p></section>)}</div></article></div>;
}
