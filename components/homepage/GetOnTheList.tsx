"use client";

import { useState } from "react";
import { WhiteBand } from "@/components/ui/WhiteBand";

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
    <section className="py-20 md:py-28 px-6 bg-void">
      <WhiteBand />

      <div className="max-w-md mx-auto text-center py-8">
        <span className="font-mono text-sm text-muted uppercase tracking-[0.15em] block mb-8">
          NEXT ARRIVAL: YOUR INBOX
        </span>

        {submitted ? (
          <p className="font-mono text-xs text-line-green">
            You&apos;re on the list.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-transparent border-0 border-b border-muted focus:border-cream font-mono text-sm text-cream placeholder:text-muted/50 focus:outline-none transition-colors py-3"
            />
            <button
              type="submit"
              className="font-mono text-xs text-muted hover:text-white tracking-[0.1em] mt-4 transition-colors"
            >
              SUBSCRIBE &rarr;
            </button>
          </form>
        )}

        {error && (
          <p className="font-mono text-xs text-line-red mt-2">{error}</p>
        )}
      </div>

      <WhiteBand />
    </section>
  );
}
