"use client";

import { useState } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function GetOnTheList() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }

    // For now, just store locally. Can integrate Mailchimp/Klaviyo later.
    try {
      // TODO: POST to /api/subscribe when email service is connected
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-lg mx-auto text-center">
        <ScrollReveal>
          <h2 className="font-editorial italic text-3xl md:text-4xl text-cream mb-3">
            Your name on the list?
          </h2>
          <p className="font-body text-muted text-sm mb-8">
            Early access to drops, behind-the-scenes, and stories from the
            after hours. No spam. Just the agenda.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          {submitted ? (
            <div className="py-4">
              <p className="font-display font-bold text-glow text-lg">
                You&apos;re on the list.
              </p>
              <p className="font-mono text-xs text-muted mt-2">
                Welcome to the agenda.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 bg-surface border border-border rounded-sm font-mono text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:border-glow/50 focus:ring-1 focus:ring-glow/20 transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-cream text-void font-display font-bold text-sm tracking-wide hover:bg-cream/80 transition-colors whitespace-nowrap"
              >
                I&apos;M IN
              </button>
            </form>
          )}
          {error && (
            <p className="font-mono text-xs text-danger mt-2">{error}</p>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
