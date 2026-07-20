"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Auto-load this many batches on scroll, then hand control back to a "Load more"
// button. Baymard's e-commerce finding: a lazy-load + manual-button hybrid beats
// pure infinite scroll — the footer stays reachable and shoppers keep a sense of
// progress. NN/g's top infinite-scroll failure (losing your place on Back) is
// fixed here by persisting the reveal count + scroll position per list.
const MAX_AUTO_BATCHES = 3;

interface Options {
  /** Batch size (how many more to reveal per step). */
  pageSize: number;
  /** Total items after filtering — the ceiling for visibleCount. */
  total: number;
  /** Extra key so different filtered views on one path persist separately. */
  keySuffix?: string;
}

interface Result {
  visibleCount: number;
  hasMore: boolean;
  /** Show the manual "Load more" button (more remain AND auto-load is paused). */
  showLoadMore: boolean;
  /** Attach to the sentinel element rendered just below the grid. */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Manual "Load more" click — reveals a batch and re-arms auto-load. */
  loadMore: () => void;
  /** Reset to the first page (call when filters/sort change). */
  reset: () => void;
}

export function useInfiniteList({ pageSize, total, keySuffix = "" }: Options): Result {
  const pathname = usePathname();
  const storageKey = `aha:list:${pathname}:${keySuffix}`;

  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [autoPaused, setAutoPaused] = useState(false);
  const autoBatchesRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ── Restore reveal count + scroll on mount (Back from a PDP lands in place) ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { count?: number; scrollY?: number };
      if (saved.count && saved.count > pageSize) {
        setVisibleCount(Math.max(pageSize, saved.count));
        // Anything already auto-revealed shouldn't instantly auto-load more.
        setAutoPaused(true);
      }
      if (saved.scrollY) {
        // Scroll after the restored items paint (two frames = post-layout).
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved.scrollY!)));
      }
    } catch {
      /* sessionStorage unavailable — no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist reveal count + scroll (throttled to a frame) ──
  useEffect(() => {
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ count: visibleCount, scrollY: window.scrollY }));
        } catch {
          /* ignore */
        }
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    save();
    return () => {
      window.removeEventListener("scroll", save);
      cancelAnimationFrame(raf);
    };
  }, [visibleCount, storageKey]);

  const hasMore = visibleCount < total;
  const autoEnabled = hasMore && !autoPaused;

  // ── Auto-load via IntersectionObserver, up to the batch cap ──
  useEffect(() => {
    if (!autoEnabled) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        autoBatchesRef.current += 1;
        setVisibleCount((count) => count + pageSize);
        if (autoBatchesRef.current >= MAX_AUTO_BATCHES) setAutoPaused(true);
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoEnabled, pageSize]);

  const loadMore = useCallback(() => {
    autoBatchesRef.current = 0;
    setAutoPaused(false);
    setVisibleCount((count) => count + pageSize);
  }, [pageSize]);

  const reset = useCallback(() => {
    autoBatchesRef.current = 0;
    setAutoPaused(false);
    setVisibleCount(pageSize);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [pageSize, storageKey]);

  return {
    visibleCount,
    hasMore,
    showLoadMore: hasMore && autoPaused,
    sentinelRef,
    loadMore,
    reset,
  };
}
