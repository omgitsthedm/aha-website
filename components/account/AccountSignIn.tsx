"use client";

import { FormEvent, useState } from "react";

export function AccountSignIn({ linkError }: { linkError?: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const email = String(new FormData(e.currentTarget).get("email") || "");
    try {
      const res = await fetch("/api/account/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch { setStatus("error"); }
  }

  if (status === "sent") {
    return (
      <div role="status" className="border-y border-border/40 py-8">
        <p className="font-display text-2xl font-bold uppercase">Check your email</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">If an account matches that address, a one-time sign-in link is on its way. It works once and expires in 20 minutes.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md border-y border-border/40 py-8">
      {linkError && <p className="mb-4 border border-warning/50 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-wide text-warning">That sign-in link expired or was already used. Request a fresh one.</p>}
      <label htmlFor="account-email" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Email address</label>
      <input id="account-email" name="email" type="email" required autoComplete="email" placeholder="you@email.com"
        className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none" />
      <button type="submit" disabled={status === "sending"} className="primary-action mt-4 min-h-12 px-6 py-3 text-sm disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {status === "error" && <p className="mt-3 text-xs font-bold text-danger">Couldn&rsquo;t send the link. Try again in a moment.</p>}
      <p className="mt-4 text-xs leading-relaxed text-muted">No passwords. We email you a one-time link. You can always <a href="/track-order" className="text-accent underline underline-offset-4">track an order</a> without an account.</p>
    </form>
  );
}
