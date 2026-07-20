"use client";

import { useEffect, useRef } from "react";

/**
 * Infinite-scroll sentinel. Attach the returned ref to an element rendered just
 * below the grid; when it scrolls into view (with a preload margin) and `enabled`
 * is true, `onLoadMore` fires. Pair it with a visible fallback button so keyboard
 * and no-JS users can still advance if IntersectionObserver is unavailable.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onLoadMore: () => void,
  enabled: boolean,
) {
  const sentinelRef = useRef<T | null>(null);
  // Keep the latest callback without re-subscribing the observer every render.
  const callback = useRef(onLoadMore);
  callback.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: "600px 0px" }, // load the next batch before the user hits the end
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
