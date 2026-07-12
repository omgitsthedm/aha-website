"use client";

import { useState } from "react";

export function GetOnTheList() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    const formData = new FormData(event.currentTarget);
    const body = new URLSearchParams();
    formData.forEach((value, key) => body.append(key, String(value)));
    try {
      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!response.ok) throw new Error("submission failed");
      setStatus("success");
      event.currentTarget.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="newsletter" className="relative z-[2] scroll-mt-28 px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto grid max-w-5xl gap-8 border-t-2 border-accent pt-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
        <div>
          <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">The After Hours Dispatch</p>
          <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">News worth staying up for</h2>
          <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-muted">New pieces, honest restocks, design notes, and occasional city dispatches. No daily noise and no fake urgency.</p>
        </div>

        {status === "success" ? (
          <div role="status" className="border border-success p-5">
            <p className="font-mono text-sm font-bold text-success">You are on the list.</p>
            <p className="mt-2 font-mono text-sm text-muted">The next dispatch will arrive when there is something worth sending.</p>
          </div>
        ) : (
          <form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={handleSubmit} noValidate>
            <input type="hidden" name="form-name" value="newsletter" />
            <p className="hidden"><label>Do not fill this out: <input name="bot-field" /></label></p>
            <label htmlFor="newsletter-email" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream">Email address</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input id="newsletter-email" name="email" type="email" required autoComplete="email" placeholder="name@example.com" aria-describedby={status === "error" ? "newsletter-error" : "newsletter-help"} className="min-h-12 flex-1 border border-border/60 bg-void px-4 py-3 font-mono text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none" />
              <button type="submit" disabled={status === "submitting"} className="primary-action min-h-12 px-6 py-3 text-sm">
                {status === "submitting" ? "Joining…" : "Get the dispatch"}
              </button>
            </div>
            <p id="newsletter-help" className="mt-3 font-mono text-xs leading-relaxed text-muted">We use this address only for AHA email updates. Leave anytime from the unsubscribe link in a message.</p>
            {status === "error" && <p id="newsletter-error" role="alert" className="mt-3 font-mono text-sm text-danger">We could not save your email. Try again, or contact info@afterhoursagenda.com.</p>}
          </form>
        )}
      </div>
    </section>
  );
}
