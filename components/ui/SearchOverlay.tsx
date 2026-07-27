"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResilientImage } from "@/components/ui/ResilientImage";
import Link from "next/link";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { SheepMark } from "@/components/ui/SheepMark";

export interface SearchIndexItem {
  name: string;
  slug: string;
  priceFormatted: string;
  image: string;
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  index: SearchIndexItem[];
}

function scoreMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  // every query word appears somewhere
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => n.includes(w))) return 40;
  return 0;
}

/**
 * Levenshtein distance, abandoned as soon as it provably exceeds `max`. Runs
 * over ~122 short product names, and only when the exact tier above already
 * came back empty, so the cost never lands on a successful search.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * How wrong a word may be before it stops being a typo. Two edits on a short
 * word matches almost anything ("tee" would reach "the"), so the budget scales
 * with length: "hoodei" → "hoodie" is two edits over six characters and still
 * qualifies, while anything under four characters has to be spelled right.
 */
function typoBudget(word: string): number {
  if (word.length >= 6) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

/**
 * Also measures against the head of a longer catalog word, so the plurals this
 * catalog is full of stay reachable — "stikcer" is three edits from "Stickers"
 * but two from "Sticker".
 */
function wordDistance(word: string, candidate: string, max: number): number {
  const whole = editDistance(word, candidate, max);
  if (whole === 0 || candidate.length <= word.length) return whole;
  return Math.min(whole, editDistance(word, candidate.slice(0, word.length), max));
}

/**
 * Fallback tier: every query word must land within its typo budget of some word
 * in the product name. Higher is closer.
 */
function fuzzyScore(name: string, query: string): number {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const candidates = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0 || candidates.length === 0) return 0;
  let total = 0;
  for (const word of words) {
    const budget = typoBudget(word);
    let best = budget + 1;
    for (const candidate of candidates) {
      const distance = wordDistance(word, candidate, budget);
      if (distance < best) best = distance;
      if (best === 0) break;
    }
    if (best > budget) return 0;
    total += budget + 1 - best;
  }
  return total;
}

export function SearchOverlay({ open, onClose, index }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const exactResults = useMemo(() => {
    if (!query.trim()) return [];
    return index
      .map((item) => ({ item, score: scoreMatch(item.name, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, 8)
      .map((r) => r.item);
  }, [index, query]);

  // Second tier only — a typo-tolerant pass never competes with, reorders or
  // dilutes an exact match, it just stands in for the dead end.
  const fuzzyResults = useMemo(() => {
    const trimmed = query.trim();
    if (exactResults.length > 0 || trimmed.length < 3) return [];
    return index
      .map((item) => ({ item, score: fuzzyScore(item.name, trimmed) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, 8)
      .map((r) => r.item);
  }, [index, query, exactResults]);

  const results = exactResults.length > 0 ? exactResults : fuzzyResults;
  const corrected = exactResults.length === 0 && fuzzyResults.length > 0;

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      trackCommerceEvent({ name: results.length ? "search" : "search_no_results", resultCount: results.length });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query, results.length]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button type="button" aria-label="Close search" className="cart-backdrop-enter absolute inset-0 h-full w-full cursor-default bg-void/80" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search products" className="cart-dialog-enter absolute left-1/2 top-16 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
        <div className="fold-surface bg-surface p-4 sm:p-5">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            autoComplete="off"
            className="min-h-12 w-full border border-border/60 bg-void px-4 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none"
          />

          {query.trim() && (
            <div className="mt-3 max-h-[55dvh] overflow-y-auto" aria-live="polite">
              {results.length > 0 ? (
                <>
                  {corrected && (
                    <p className="pb-3 text-sm text-muted">No exact match for “{query.trim()}”. Closest pieces:</p>
                  )}
                  <ul className="divide-y divide-border/40">
                    {results.map((item) => (
                      <li key={item.slug}>
                        <Link href={`/product/${item.slug}`} onClick={onClose} className="group flex min-h-16 items-center gap-4 py-2 pr-2">
                          <span className="relative block h-14 w-14 shrink-0 overflow-hidden border border-border/40 bg-surface">
                            {item.image && <ResilientImage src={item.image} alt="" fill className={isPrintfulImage(item.image) ? "object-contain" : "object-cover"} sizes="56px" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-display text-sm font-bold uppercase leading-tight text-cream group-hover:text-accent">{item.name}</span>
                          <span className="font-mono text-xs font-bold text-muted">{item.priceFormatted}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="py-6 text-center">
                  <SheepMark className="mx-auto mb-4 w-16 text-muted" />
                  <p className="text-sm text-muted">Nothing matches “{query}”.</p>
                  <Link href="/shop" onClick={onClose} className="mt-3 inline-flex min-h-11 items-center text-xs font-bold uppercase text-accent underline underline-offset-4">Browse the full catalog</Link>
                </div>
              )}
              {results.length > 0 && (
                <div className="border-t border-border/40 pt-3 text-center">
                  <Link href="/shop" onClick={onClose} className="inline-flex min-h-11 items-center text-xs font-bold uppercase text-accent underline underline-offset-4">See everything in Shop</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
