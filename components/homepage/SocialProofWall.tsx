"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WallReview {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  verified: boolean;
  productSlug: string;
}

const slugToName = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Site-wide social proof — REAL, moderated reviews only. Renders nothing until
 * approved reviews exist (never fabricated proof, never an empty "no reviews"
 * shell). Lights up automatically as the review flywheel fills.
 */
export function SocialProofWall() {
  const [reviews, setReviews] = useState<WallReview[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews?wall=1")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => { if (active && Array.isArray(data.items)) setReviews(data.items); })
      .catch(() => { /* silent — the section just stays hidden */ });
    return () => { active = false; };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="proof-heading" className="mx-auto mt-20 max-w-[1280px] px-4 sm:px-6 lg:mt-28">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div className="m-rise">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Verified buyers</p>
          <h2 id="proof-heading" className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-bold uppercase leading-none tracking-[-0.045em] text-cream">In their words</h2>
        </div>
      </div>
      <ul className="m-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id} className="hover-fold fold-surface flex flex-col border border-border/40 bg-surface p-6">
            <div className="flex items-center gap-2">
              <span className="text-accent" aria-hidden="true">{"★".repeat(Math.max(1, Math.min(5, r.rating)))}</span>
              <span className="sr-only">{r.rating} out of 5 stars</span>
              {r.verified && <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-success">Verified</span>}
            </div>
            {r.title && <p className="mt-3 font-display text-lg font-bold uppercase tracking-[-0.02em] text-cream">{r.title}</p>}
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{r.body}</p>
            <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-cream">{r.authorName}</p>
            <Link href={`/product/${r.productSlug}`} className="m-underline mt-1 self-start font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-accent">
              {slugToName(r.productSlug)} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
