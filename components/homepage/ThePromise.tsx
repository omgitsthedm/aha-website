"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";

const promises = [
  {
    label: "Tracked Shipping",
    detail: "Free on orders $75+",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    label: "Easy Exchanges",
    detail: "30-day returns",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      </svg>
    ),
  },
  {
    label: "Secure Checkout",
    detail: "256-bit encryption",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
];

export function ThePromise() {
  return (
    <section className="relative py-20 md:py-28 px-6 bg-charcoal">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal stagger>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
            {promises.map((promise) => (
              <div
                key={promise.label}
                className="text-center"
              >
                <div className="flex justify-center mb-4 text-gold">
                  {promise.icon}
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-cream mb-1">
                  {promise.label}
                </h3>
                <p className="font-mono text-[11px] text-muted">
                  {promise.detail}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
