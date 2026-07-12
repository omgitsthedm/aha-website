export const metadata = { title: "Operations Sign In", robots: { index: false, follow: false } };

export default async function OpsLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const failed = Boolean((await searchParams).error);
  return <main className="px-4 pb-24 pt-32 md:px-6"><div className="mx-auto max-w-md border-t-2 border-accent pt-6">
    <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Private operations</p>
    <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.05em]">Sign in</h1>
    <p className="mt-4 text-sm leading-relaxed text-muted">Production orders, fulfillment exceptions, and provider health.</p>
    <form action="/api/ops/session" method="post" className="mt-8">
      <label htmlFor="password" className="mb-2 block font-mono text-xs font-bold uppercase text-cream">Operations password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream focus:border-accent focus:outline-none" />
      {failed && <p role="alert" className="mt-3 text-sm text-error">That password was not accepted.</p>}
      <button className="primary-action mt-6 min-h-12 w-full px-5 py-3 text-sm">Open operations</button>
    </form>
  </div></main>;
}
