"use client";

import { useState, useRef } from "react";
import { SplitFlap } from "@/components/ui/SplitFlap";

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
    <section ref={sectionRef} className="py-24 md:py-32 px-6">
      <div className="max-w-lg mx-auto">
        {/* NYCTA Sign Panel */}
        <div className="mb-12">
          <div className="mosaic-border" />
          <div className="sign-panel-station justify-center">
            <span className="sign-panel-station-text">Stay in the Know</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <div ref={formRef} className="text-center py-8">
          {submitted ? (
            <div className="flex justify-center">
              <SplitFlap value="SUBSCRIBED" fontSize="1.5rem" />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent border-0 border-b border-cream/40 focus:border-cream font-body text-sm text-cream placeholder:text-muted/70 focus:outline-none transition-all duration-500 py-4 focus:shadow-[0_1px_0_0_rgba(26,25,23,0.3)]"
              />
              <button
                type="submit"
                className="metrocard-gradient px-8 py-3 font-body text-xs font-bold tracking-[0.15em] mt-8 hover:brightness-110 transition-all uppercase"
              >
                Join &rarr;
              </button>
            </form>
          )}

          {error && (
            <p className="font-body text-xs text-line-red mt-3">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}
