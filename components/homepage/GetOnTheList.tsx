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
    <section ref={sectionRef} className="py-24 md:py-32 px-6 bg-void border-t border-b border-cream/[0.06]">
      <div ref={formRef} className="max-w-lg mx-auto text-center py-8">
        <span
          className="font-mono text-muted uppercase block mb-10"
          style={{
            fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
            letterSpacing: "0.25em",
          }}
        >
          Next Arrival: Your Inbox
        </span>

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
              className="w-full bg-transparent border-0 border-b border-cream/20 focus:border-cream font-mono text-sm text-cream placeholder:text-muted/40 focus:outline-none transition-all duration-500 py-4 focus:shadow-[0_1px_0_0_rgba(232,228,222,0.4)]"
            />
            <button
              type="submit"
              className="font-mono text-xs text-muted hover:text-white tracking-[0.15em] mt-6 transition-colors duration-300 uppercase"
            >
              Subscribe &rarr;
            </button>
          </form>
        )}

        {error && (
          <p className="font-mono text-xs text-line-red mt-3">{error}</p>
        )}
      </div>
    </section>
  );
}
