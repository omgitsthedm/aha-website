export function ThePromise() {
  return (
    <section aria-labelledby="order-promise-title" className="relative z-[2] border-y border-border/40 bg-charcoal px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-[1440px]">
        <h2 id="order-promise-title" className="sr-only">What to expect when ordering</h2>
        <dl className="grid gap-0 md:grid-cols-[1.35fr_1fr_1fr]">
          <div className="border-b border-border/40 pb-8 md:border-b-0 md:border-r md:pb-0 md:pr-12"><dt className="font-display text-[clamp(2.5rem,5vw,5rem)] font-bold uppercase leading-[0.85] tracking-[-0.05em] text-cream">Made after you order</dt><dd className="mt-4 max-w-lg font-mono text-sm leading-relaxed text-muted">Production usually takes 2-5 business days before carrier transit begins.</dd></div>
          <div className="border-b border-border/40 py-8 md:border-b-0 md:border-r md:px-8 md:py-0"><dt className="font-display text-2xl font-bold uppercase tracking-[-0.035em] text-cream">Shipping included</dt><dd className="mt-2 max-w-sm font-mono text-sm leading-relaxed text-muted">The final tax amount appears before payment.</dd></div>
          <div className="pt-8 md:pl-8 md:pt-0"><dt className="font-display text-2xl font-bold uppercase tracking-[-0.035em] text-cream">30-day returns</dt><dd className="mt-2 max-w-sm font-mono text-sm leading-relaxed text-muted">Unworn pieces can be returned within 30 days.</dd></div>
        </dl>
      </div>
    </section>
  );
}
