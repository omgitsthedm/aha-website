export const metadata = {
  title: "Accessibility",
  description:
    "Accessibility statement and support contact for After Hours Agenda.",
};

export default function AccessibilityPage() {
  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="misprint mb-8 text-center font-display text-[clamp(3.5rem,9vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
          ACCESSIBILITY
        </h1>

        <div className="space-y-6 font-body leading-relaxed text-cream/80">
          <section className="zine-block p-6 md:p-8">
            <h2 className="mb-3 font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] text-cream">
              Our Standard
            </h2>
            <p className="font-bold">
              After Hours Agenda is working toward WCAG 2.2 AA as the operating
              accessibility standard for this storefront. The goal is simple:
              shop, review your bag, and get support without guessing or
              fighting the interface.
            </p>
          </section>

          <section className="zine-block p-6 md:p-8">
            <h2 className="mb-3 font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] text-cream">
              What We Check
            </h2>
            <ul className="list-disc space-y-2 pl-5 font-bold">
              <li>Keyboard access for navigation, product choices, and cart actions.</li>
              <li>Visible focus states and touch targets sized for phones.</li>
              <li>Readable contrast across dark, neon, and paper-style surfaces.</li>
              <li>Semantic headings, labels, skip link, and useful page titles.</li>
              <li>Reduced-motion support for nonessential animation.</li>
            </ul>
          </section>

          <section className="zine-block p-6 md:p-8">
            <h2 className="mb-3 font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] text-cream">
              Need Help?
            </h2>
            <p className="font-bold">
              If anything blocks you from browsing, choosing a size, reviewing
              your bag, or contacting us, email{" "}
              <a
                href="mailto:hello@afterhoursagenda.com"
                className="text-[#CCFF00] underline underline-offset-4"
              >
                hello@afterhoursagenda.com
              </a>
              . Include the page, device, browser, and assistive technology if
              you can. We will treat accessibility blockers as support issues,
              not design preferences.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
