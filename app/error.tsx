"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the digest so storefront errors are visible in server/monitoring logs
    // instead of being silently swallowed by the boundary.
    console.error("Storefront error boundary:", error.digest ?? error.message, error);
  }, [error]);
  return <div className="flex min-h-[70vh] items-center px-4 pb-16 pt-28 md:px-6"><div className="mx-auto w-full max-w-3xl border-t-2 border-accent pt-6"><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent">Storefront error</p><h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,6rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Something broke</h1><p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">The page could not finish loading. Try it again, or return to the catalog.</p><div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={reset} className="primary-action min-h-11 px-5 py-3 text-xs">Try again</button><Link href="/shop" className="inline-flex min-h-11 items-center border border-border/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">Open shop</Link></div></div></div>;
}
