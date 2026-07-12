import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Customer and Order Support", description: "Contact After Hours Agenda for help with an order, product, fit, return, or accessibility issue. Include the order number, but never send card details.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Customer support" title="Talk to us" description="Questions about an order, product, fit, return, or site access all go to the same place." />
        <div className="grid border-y border-border/40 md:grid-cols-2">
          <section className="border-b border-border/40 py-7 md:border-b-0 md:border-r md:pr-8"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Email</p><h2 className="mt-3 font-display text-2xl font-black uppercase">hello@afterhoursagenda.com</h2><a href="mailto:hello@afterhoursagenda.com" className="mt-5 inline-flex min-h-11 items-center border border-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-accent hover:bg-accent hover:text-void">Open email</a></section>
          <section className="py-7 md:pl-8"><p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Order help</p><h2 className="mt-3 font-display text-2xl font-black uppercase">Include the order number</h2><p className="mt-3 text-sm leading-relaxed text-muted">For an existing order, include the confirmation number and the email used at checkout. Do not send card details.</p></section>
        </div>
      </div>
    </div>
  );
}
