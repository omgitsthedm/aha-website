import Link from "next/link";

export default function NotFound() {
  return <div className="flex min-h-[70vh] items-center px-4 pb-16 pt-28 md:px-6"><div className="mx-auto w-full max-w-3xl border-t-2 border-accent pt-6"><p className="font-mono text-sm font-bold text-accent">404 / NOT FOUND</p><h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,6rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Wrong turn</h1><p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">This page does not exist or has moved. Use the catalog to get back on track.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/shop" className="primary-action min-h-11 px-5 py-3 text-xs">Open shop</Link><Link href="/" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Go home</Link></div></div></div>;
}
