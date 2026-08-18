"use client";

import { useRef, useState } from "react";
import type { ReviewSummary } from "@/lib/commerce/reviews";
import { FIT_LABEL } from "@/lib/commerce/fit";
import { Stars } from "@/components/product/Stars";

const dateFmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function ProductReviews({ productSlug, initial }: { productSlug: string; initial: ReviewSummary }) {
  const [summary] = useState(initial);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [form, setForm] = useState({ authorName: "", title: "", body: "", email: "", company: "", sizePurchased: "", fit: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, rating, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not submit your review.");
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not submit your review.");
    }
  };

  // ARIA APG radiogroup: one tab stop for the whole rating, arrow keys move
  // between stars. Five separate tab stops made the shortest field in the form
  // the longest to get past.
  const onStarKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: number) => {
    const last = STAR_VALUES.length;
    let next = value;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = value === last ? 1 : value + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = value === 1 ? last : value - 1;
    else if (event.key === "Home") next = 1;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    setRating(next);
    starRefs.current[next - 1]?.focus();
  };

  const field = "min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted";
  // Every control below carries a visible <label> in this class. Placeholders are
  // examples only: a placeholder disappears the moment someone types, so a form
  // labelled by placeholders is an unlabelled form the moment it is filled in.
  const labelC = "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-16 scroll-mt-28 border-t border-border/40 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="editorial-title text-3xl text-cream">Reviews</h2>
          {summary.count > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-cream">
              <Stars rating={summary.average} /> <span>{summary.average.toFixed(1)}</span>
              <span className="text-muted">· {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
            </p>
          ) : null}
          {/* States what this system actually is, in the same terms as the FAQ
              answer, so the two surfaces agree. Honest moderation is a stronger
              trust signal than a review count — and a new release does not need
              to announce that nobody has reviewed it yet. */}
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {summary.count > 0
              ? "Reviews come from buyers. Every one is read and approved by a person before it publishes, and a Verified badge means the review was matched to a real order. We do not write, buy, or edit reviews."
              : "Reviews come from real customers and are read by a person before they publish. Wear it first, then tell us how it wears."}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="btn-secondary min-h-11 whitespace-nowrap">
          {open ? "Close" : "Write a review"}
        </button>
      </div>

      {open && (
        <div className="mt-6 border border-border/40 p-5">
          {state === "done" ? (
            <p role="status" className="text-sm font-bold text-success">Thanks — your review was submitted and will appear once it&rsquo;s approved.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-4" noValidate>
              <div>
                <span id="review-rating-label" className={labelC}>Your rating</span>
                <div className="flex gap-1" role="radiogroup" aria-labelledby="review-rating-label">
                  {STAR_VALUES.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      ref={(node) => { starRefs.current[n - 1] = node; }}
                      tabIndex={rating === n ? 0 : -1}
                      onKeyDown={(event) => onStarKeyDown(event, n)}
                      onClick={() => setRating(n)}
                      className={`flex h-11 w-11 items-center justify-center border text-xl transition-colors ${n <= rating ? "border-accent text-accent" : "border-border/60 text-muted hover:text-accent"}`}>★</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelC} htmlFor="review-author">Your name</label>
                <input id="review-author" name="authorName" autoComplete="name" required placeholder="e.g. Alex R." className={field}
                  value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
              </div>
              <div>
                <label className={labelC} htmlFor="review-title">Headline (optional)</label>
                <input id="review-title" name="title" placeholder="e.g. Wears great, holds its shape" className={field}
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={labelC} htmlFor="review-body">Your review</label>
                <textarea id="review-body" name="body" required placeholder="How does it fit and wear?" rows={4} className={`${field} resize-y`}
                  value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              {/* Optional fit context — the single biggest apparel sizing signal. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelC} htmlFor="review-size">Size you bought (optional)</label>
                  <input id="review-size" name="sizePurchased" placeholder="e.g. M" className={field}
                    value={form.sizePurchased} onChange={(e) => setForm({ ...form, sizePurchased: e.target.value })} />
                </div>
                <div>
                  <label className={labelC} htmlFor="review-fit">How does it fit? (optional)</label>
                  <select id="review-fit" name="fit" className={`${field} cursor-pointer`}
                    value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })}>
                    <option value="">No comment</option>
                    <option value="small">Runs small</option>
                    <option value="true">True to size</option>
                    <option value="large">Runs large</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelC} htmlFor="review-email">Email (kept private)</label>
                <input id="review-email" name="email" type="email" autoComplete="email" placeholder="e.g. you@example.com" className={field}
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {/* Honeypot — hidden from real users */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden"
                value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
              <button type="submit" disabled={state === "sending"} className="btn-primary min-h-12 disabled:opacity-60">
                {state === "sending" ? "Submitting…" : "Submit review"}
              </button>
              <p className="text-xs leading-relaxed text-muted">Reviews are moderated before they appear. Your email is never shown publicly.</p>
            </form>
          )}
        </div>
      )}

      {summary.items.length > 0 && (
        <ul className="mt-8 divide-y divide-border/40">
          {summary.items.map((r) => (
            <li key={r.id} className="py-5">
              <div className="flex flex-wrap items-center gap-3">
                <Stars rating={r.rating} className="text-sm" />
                <span className="font-display text-sm font-black uppercase text-cream">{r.authorName}</span>
                {r.verified && <span className="border border-success/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-success">Verified</span>}
                <span className="ml-auto font-mono text-[11px] text-muted">{dateFmt(r.createdAt)}</span>
              </div>
              {(r.sizePurchased || r.fit) && (
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                  {r.sizePurchased && <>Bought {r.sizePurchased}</>}
                  {r.sizePurchased && r.fit && <span aria-hidden="true"> · </span>}
                  {r.fit && (FIT_LABEL[r.fit] ?? r.fit)}
                </p>
              )}
              {r.title && <p className="mt-2 font-display text-base font-black uppercase leading-tight text-cream">{r.title}</p>}
              <p className="mt-1 text-sm leading-relaxed text-cream/85">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
