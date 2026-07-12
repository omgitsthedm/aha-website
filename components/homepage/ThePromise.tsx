export function ThePromise() {
  return (
    <section aria-labelledby="order-promise-title" className="relative z-[2] border-y border-border/40 bg-charcoal px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-[1440px]">
        <h2 id="order-promise-title" className="sr-only">What to expect when ordering</h2>
        <dl className="grid gap-8 md:grid-cols-3 md:divide-x md:divide-border/40">
          <div className="md:px-7 md:first:pl-0"><dt className="font-display text-2xl font-black uppercase tracking-[-0.04em] text-cream">Made after you order</dt><dd className="mt-2 max-w-sm font-mono text-sm leading-relaxed text-muted">Production usually takes 2-5 business days before carrier transit begins.</dd></div>
          <div className="md:px-7"><dt className="font-display text-2xl font-black uppercase tracking-[-0.04em] text-cream">Shipping is included</dt><dd className="mt-2 max-w-sm font-mono text-sm leading-relaxed text-muted">Every order ships free. The final tax amount appears before payment.</dd></div>
          <div className="md:px-7"><dt className="font-display text-2xl font-black uppercase tracking-[-0.04em] text-cream">Try it at home</dt><dd className="mt-2 max-w-sm font-mono text-sm leading-relaxed text-muted">Unworn pieces can be returned within 30 days. No mystery policy.</dd></div>
        </dl>
      </div>
    </section>
  );
}
