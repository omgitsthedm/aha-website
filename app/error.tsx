"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold text-chapter mb-4">
          Something went wrong
        </h1>
        <p className="font-body text-muted mb-8">
          We hit a snag. Try refreshing or head back to the homepage.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="metrocard-gradient inline-block px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-block px-6 py-3 border border-cream/20 font-body text-xs font-bold uppercase tracking-[0.15em] hover:border-cream/40 transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
