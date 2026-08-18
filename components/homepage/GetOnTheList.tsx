import { NewsletterForm } from "@/components/forms/NewsletterForm";

export function GetOnTheList() {
  return (
    <section id="newsletter" className="relative z-[2] scroll-mt-28 px-4 py-16 md:px-6 md:py-24">
      <div className="reveal-block mx-auto grid max-w-5xl gap-8 border-t border-accent pt-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
        <div>
          <h2 className="font-display text-[clamp(2.8rem,6vw,5.5rem)] font-bold uppercase leading-[0.82] tracking-[-0.055em]">Stay close</h2>
          <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-muted">New pieces, the occasional note, and first word on releases.</p>
        </div>

        <NewsletterForm
          instanceId="newsletter"
          labelText="Email address (required)"
          labelClassName="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream"
          inputClassName="min-h-12 min-w-0 flex-1 border border-border/60 bg-void px-4 py-3 font-mono text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none"
          buttonClassName="primary-action min-h-12 px-6 py-3 text-sm aria-disabled:cursor-wait aria-disabled:opacity-60"
          buttonLabel="Get email updates"
          placeholder="name@example.com"
          helpText="We use this address only for After Hours Agenda email updates. Leave anytime from the unsubscribe link in a message."
          helpClassName="mt-3 font-mono text-xs leading-relaxed text-muted"
          messageClassName="mt-3 font-mono text-sm"
          successClassName="border border-success p-5"
          successFontClassName="font-mono"
        />
      </div>
    </section>
  );
}
