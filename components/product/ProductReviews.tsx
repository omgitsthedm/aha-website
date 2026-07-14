"use client";

import { useState } from "react";
import type { ReviewSummary } from "@/lib/commerce/reviews";

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <span aria-label={`${rating} out of 5`} className={`inline-flex ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= full ? "text-accent" : "text-muted/40"}>★</span>
      ))}
    </span>
  );
}

const dateFmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export function ProductReviews({ productSlug, initial }: { productSlug: string; initial: ReviewSummary }) {
  const [summary] = useState(initial);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [form, setForm] = useState({ authorName: "", title: "", body: "", email: "", company: "" });
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

  const field = "min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted";

  return (
    <section aria-labelledby="reviews-title" className="mt-16 border-t border-border/40 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="font-display text-2xl font-black uppercase tracking-[-0.035em] text-cream">Reviews</h2>
          {summary.count > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-cream">
              <Stars rating={summary.average} /> <span>{summary.average.toFixed(1)}</span>
              <span className="text-muted">· {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No reviews yet — be the first to share how it wears.</p>
          )}
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
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Your rating</span>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setRating(n)}
                      className={`flex h-11 w-11 items-center justify-center border text-xl transition-colors ${n <= rating ? "border-accent text-accent" : "border-border/60 text-muted/40 hover:text-accent"}`}>★</button>
                  ))}
                </div>
              </div>
              <input aria-label="Your name" required placeholder="Your name" className={field}
                value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
              <input aria-label="Headline (optional)" placeholder="Headline (optional)" className={field}
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea aria-label="Your review" required placeholder="How does it fit and wear?" rows={4} className={`${field} resize-y`}
                value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              <input aria-label="Email (not shown)" type="email" placeholder="Email (kept private)" className={field}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
              {r.title && <p className="mt-2 font-display text-base font-black uppercase leading-tight text-cream">{r.title}</p>}
              <p className="mt-1 text-sm leading-relaxed text-cream/85">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
