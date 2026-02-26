"use client";

import { useState, useRef } from "react";
import { SplitFlap } from "@/components/ui/SplitFlap";
import { WhiteBand } from "@/components/ui/WhiteBand";

import { gsap, useGSAP } from "@/lib/gsap";

export function GetOnTheList() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!formRef.current) return;

      // Form slides up from below like a turnstile panel rising
      gsap.from(formRef.current, {
        y: 60,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });
    },
    { scope: sectionRef }
  );

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
    <section ref={sectionRef} className="relative z-[2] subway-tiles-dark py-24 md:py-32 px-6 bg-[#141414]">
      <WhiteBand dark />

      <div className="max-w-lg mx-auto py-8">
        {/* NYCTA Sign Panel */}
        <div className="mb-12">
          <div className="mosaic-border" />
          <div className="sign-panel-station justify-center">
            <span className="sign-panel-station-text">Stay in the Know</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <p className="font-body text-sm text-[#7A756E] text-center mb-8 leading-relaxed">
          New drops, restocks, and stories — straight to your inbox.
        </p>

        <div ref={formRef} className="text-center">
          {submitted ? (
            <div className="flex justify-center py-8">
              <SplitFlap value="SUBSCRIBED" fontSize="1.5rem" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-describedby={error ? "newsletter-error" : undefined}
                aria-invalid={error ? true : undefined}
                autoComplete="email"
                className="w-full bg-transparent border-0 border-b border-[#E8E4DE]/20 focus:border-[#FCCC0A] font-body text-sm text-[#E8E4DE] placeholder:text-[#7A756E]/60 focus:outline-none transition-all duration-500 py-4"
              />
              <button
                type="submit"
                className="metrocard-gradient px-8 py-3 font-body text-xs font-bold tracking-[0.15em] mt-8 hover:brightness-110 transition-all uppercase min-h-[44px]"
              >
                Join &rarr;
              </button>
            </form>
          )}

          {error && (
            <p id="newsletter-error" role="alert" className="font-body text-xs text-line-red mt-3">{error}</p>
          )}
        </div>
      </div>

      <WhiteBand dark />
    </section>
  );
}
