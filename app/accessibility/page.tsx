import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";
import { buildMetadata } from "@/components/seo/buildMetadata";

export const metadata = buildMetadata({ title: "Website Accessibility", description: "Read the After Hours Agenda accessibility standard, WCAG 2.2 AA target, and contact route for reporting an access barrier.", path: "/accessibility" });

export default function AccessibilityPage() {
  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Last reviewed August 17, 2026" title="Accessibility is part of the site" description="Our working target is WCAG 2.2 AA across navigation, release updates, order status, and support. Product and checkout flows will be reviewed again before the next collection opens. This statement describes the standard we work toward, not a claim that every barrier is already gone." />
        <div className="divide-y divide-border/40 border-y border-border/40">
          <section className="grid gap-3 py-7 md:grid-cols-[12rem_1fr] md:gap-8"><h2 className="font-display text-xl font-black uppercase">What we check</h2><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-cream/85"><li>Keyboard access for navigation, forms, and existing-order support.</li><li>Visible focus, useful labels, and touch targets sized for phones.</li><li>Readable contrast across ink, paper, and accent surfaces.</li><li>Semantic headings, status messages, skip navigation, and page titles.</li><li>Reduced motion support for nonessential transitions.</li></ul></section>
          <section className="grid gap-3 py-7 md:grid-cols-[12rem_1fr] md:gap-8"><h2 className="font-display text-xl font-black uppercase">Known reality</h2><p className="text-sm leading-relaxed text-cream/85">Automated checks do not catch every barrier. Browser, device, zoom, input method, and assistive technology can expose problems that a standard test misses. We want those reports rather than hiding behind a score.</p></section>
          <section className="grid gap-3 py-7 md:grid-cols-[12rem_1fr] md:gap-8"><h2 className="font-display text-xl font-black uppercase">Need help?</h2><p className="text-sm leading-relaxed text-cream/85">If anything blocks you from using the site or getting order support, email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline underline-offset-4">{SUPPORT_EMAIL}</a>. If possible, include the page, device, browser, input method, and assistive technology. You do not need to diagnose the problem before contacting us.</p></section>
        </div>
      </div>
    </div>
  );
}
