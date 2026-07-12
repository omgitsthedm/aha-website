import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";

export const metadata = { title: "Customer and Order Support", description: "Contact After Hours Agenda for help with an order, product, fit, return, or accessibility issue. Include the order number, but never send card details.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Customer support / Real people" title="Send the useful details" description="Product, fit, order, return, and accessibility questions all reach the same support address. The details below help us answer without making you repeat yourself." />
        <div className="grid border-y border-border/40 md:grid-cols-2">
          <section className="border-b border-border/40 py-7 md:border-b-0 md:border-r md:pr-8"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Email</p><h2 className="mt-3 break-all font-display text-2xl font-black uppercase">{SUPPORT_EMAIL}</h2><a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 inline-flex min-h-11 items-center border border-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-accent hover:bg-accent hover:text-void">Email support</a><p className="mt-4 text-xs leading-relaxed text-muted">Never send card numbers, security codes, passwords, or account credentials by email.</p></section>
          <section className="py-7 md:pl-8"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">What to include</p><h2 className="mt-3 font-display text-2xl font-black uppercase">One message, enough context</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted"><li>Order number and checkout email for order questions.</li><li>Product name, size, and color for fit or item questions.</li><li>Clear photos for damage, misprints, or incorrect items.</li><li>Page, device, browser, and assistive technology for access barriers.</li></ul></section>
        </div>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/faq" className="primary-action min-h-11 px-5 py-3 text-xs">Read common answers</Link><Link href="/track-order" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Track an order</Link></div>
      </div>
    </div>
  );
}
