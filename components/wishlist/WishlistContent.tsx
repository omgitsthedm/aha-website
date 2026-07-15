"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { PageHeader } from "@/components/ui/PageHeader";
import { SheepMark } from "@/components/ui/SheepMark";

interface SavedProduct { name: string; slug: string; priceFormatted: string; image: string }

const KEY = "aha-wishlist";

function readSlugs(): string[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function WishlistContent() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<SavedProduct[]>([]);

  useEffect(() => {
    const slugs = readSlugs();
    if (slugs.length === 0) { setReady(true); return; }
    const controller = new AbortController();
    fetch("/api/search-index", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((all: SavedProduct[]) => {
        const order = new Map(slugs.map((s, i) => [s, i]));
        const saved = (Array.isArray(all) ? all : [])
          .filter((p) => order.has(p.slug))
          .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
        setItems(saved);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => controller.abort();
  }, []);

  const remove = (slug: string) => {
    const next = readSlugs().filter((s) => s !== slug);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setItems((prev) => prev.filter((p) => p.slug !== slug));
  };

  if (!ready) {
    return <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-6xl"><p className="text-sm text-muted">Loading your saved pieces…</p></div></div>;
  }

  if (items.length === 0) {
    return (
      <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Saved" title="Your wishlist" description="Nothing saved yet. Tap the heart on any product to keep it here for later — it stays in this browser." />
        <div className="mt-2 flex flex-col items-start gap-4">
          <SheepMark className="w-16 text-muted" />
          <Link href="/shop" className="primary-action inline-flex min-h-11 items-center px-5 py-3 text-xs">Browse the shop</Link>
        </div>
      </div></div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`${items.length} saved`} title="Your wishlist" description="Saved for later, kept in this browser. Tap through when you're ready." />
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-5">
        {items.map((p) => (
          <div key={p.slug} className="group block">
            <Link href={`/product/${p.slug}`} className="relative block aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
              {p.image && <Image src={p.image} alt={p.name} fill className={`${isPrintfulImage(p.image) ? "object-contain" : "object-cover"} transition-transform duration-300 group-hover:scale-[1.02]`} sizes="(max-width: 768px) 50vw, 25vw" />}
            </Link>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/product/${p.slug}`} className="line-clamp-2 font-display text-sm font-black uppercase leading-tight hover:text-accent">{p.name}</Link>
                <p className="mt-1 text-xs font-bold text-muted">{p.priceFormatted}</p>
              </div>
              <button type="button" onClick={() => remove(p.slug)} aria-label={`Remove ${p.name} from wishlist`} className="shrink-0 text-muted transition-colors hover:text-accent">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div></div>
  );
}
