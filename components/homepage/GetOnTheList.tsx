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
    <section ref={sectionRef} className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <WhiteBand dark />

      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-12">
          <div className="mosaic-border" />
          <div className="sign-panel-station justify-center">
            <span className="sign-panel-station-text">Get on the List</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <p className="mb-8 text-center font-body text-base font-bold leading-relaxed text-[#E9E1D4]">
          Drop alerts, restocks, and odd little dispatches. No polished brand noise.
        </p>

        <div ref={formRef} className="zine-block p-5 text-center md:p-8">
          {submitted ? (
            <div className="flex justify-center py-8">
              <SplitFlap value="SUBSCRIBED" fontSize="1.5rem" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="newsletter-email" className="mb-3 block text-left font-body text-xs font-bold uppercase tracking-[0.08em] text-[#CCFF00]">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                aria-describedby={error ? "newsletter-error" : undefined}
                aria-invalid={error ? true : undefined}
                autoComplete="email"
                className="min-h-12 w-full border-[3px] border-[#E9E1D4] bg-[#10100F] px-4 py-3 font-body text-base font-bold text-[#E9E1D4] placeholder:text-[#A9A093] focus:border-[#00FFFF] focus:outline-none"
              />
              <button
                type="submit"
                className="metrocard-gradient mt-8 min-h-12 px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.12em] transition-transform hover:-translate-y-1 active:translate-y-0"
              >
                Join
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
