"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface RecentItem {
  slug: string;
  name: string;
  image: string;
  priceFormatted: string;
}

const KEY = "aha-recent-views";
const MAX = 8;

/**
 * Recently-viewed rail — client-only, localStorage-backed. Records the current
 * PDP on view and shows the ones seen before it (excluding the current product).
 * Renders nothing until there's real history, so a first-time visitor sees no
 * empty shell.
 */
export function RecentlyViewed({ current }: { current: RecentItem }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    let prior: RecentItem[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) prior = parsed.filter((p): p is RecentItem => Boolean(p && typeof p.slug === "string"));
    } catch {
      prior = [];
    }
    // Display what was seen before this view (minus the current product).
    setItems(prior.filter((p) => p.slug !== current.slug).slice(0, MAX));
    // Record the current product at the front, de-duped and capped.
    const next = [current, ...prior.filter((p) => p.slug !== current.slug)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — non-fatal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.slug]);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-title" className="mt-16 border-t border-border/40 pt-10">
      <h2 id="recently-viewed-title" className="mb-7 font-display text-[clamp(1.5rem,4vw,2.5rem)] font-black uppercase leading-none tracking-[-0.04em]">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-5">
        {items.map((item) => (
          <Link key={item.slug} href={`/product/${item.slug}`} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
              {item.image ? <Image src={item.image} alt={item.name} fill className={`${isPrintfulImage(item.image) ? "object-contain" : "object-cover"} transition-transform duration-300 group-hover:scale-[1.02]`} sizes="(max-width: 768px) 50vw, 25vw" /> : null}
            </div>
            <h3 className="mt-3 font-display text-sm font-black uppercase leading-tight">{item.name}</h3>
            <p className="mt-1 text-xs font-bold text-muted">{item.priceFormatted}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
