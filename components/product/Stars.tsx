/** Shared 5-star rating glyphs (rounded). Honest: only render when real reviews exist. */
export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <span aria-label={`${rating} out of 5`} className={`inline-flex ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= full ? "text-accent" : "text-muted/40"}>★</span>
      ))}
    </span>
  );
}
