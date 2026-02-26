import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <span className="font-mono text-6xl text-muted block mb-4">404</span>
        <h1 className="font-display font-bold text-chapter mb-4">
          Page Not Found
        </h1>
        <p className="font-body text-muted mb-8">
          This page doesn&apos;t exist. It might have been moved or the URL may be
          incorrect.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="metrocard-gradient inline-block px-6 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
          >
            Go Home
          </Link>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 border border-cream/20 font-body text-xs font-bold uppercase tracking-[0.15em] hover:border-cream/40 transition-all"
          >
            Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
