import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Accessibility", description: "Accessibility statement and support contact for After Hours Agenda.", alternates: { canonical: "/accessibility" } };

export default function AccessibilityPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Store standard" title="Accessibility" description="Our target is WCAG 2.2 AA across browsing, product selection, bag review, checkout, and support." />
        <div className="divide-y divide-border/40 border-y border-border/40">
          <section className="grid gap-3 py-7 md:grid-cols-[12rem_1fr] md:gap-8"><h2 className="font-display text-xl font-black uppercase">What we check</h2><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cream/85"><li>Keyboard access for navigation, product options, and bag actions.</li><li>Visible focus, useful labels, and touch targets sized for phones.</li><li>Readable contrast across ink, paper, and accent surfaces.</li><li>Semantic headings, status messages, skip navigation, and page titles.</li><li>Reduced motion support for nonessential transitions.</li></ul></section>
          <section className="grid gap-3 py-7 md:grid-cols-[12rem_1fr] md:gap-8"><h2 className="font-display text-xl font-black uppercase">Need help?</h2><p className="text-sm leading-relaxed text-cream/85">If anything blocks you from browsing or buying, email <a href="mailto:hello@afterhoursagenda.com" className="text-accent underline underline-offset-4">hello@afterhoursagenda.com</a>. If possible, include the page, device, browser, and assistive technology. Accessibility blockers are support issues and will be treated that way.</p></section>
        </div>
      </div>
    </div>
  );
}
