"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";

const promises = [
  {
    icon: "🔒",
    label: "Secure Checkout",
    detail: "256-bit SSL encryption",
  },
  {
    icon: "📦",
    label: "Free Shipping",
    detail: "On orders $75+",
  },
  {
    icon: "↩️",
    label: "30-Day Returns",
    detail: "No questions asked",
  },
  {
    icon: "🖨️",
    label: "Made to Order",
    detail: "Printed just for you",
  },
];

export function ThePromise() {
  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Dark textured background */}
      <div className="absolute inset-0 bg-surface" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3">
              The Promise
            </span>
            <h2 className="font-display font-bold text-3xl md:text-chapter">
              We&apos;ve got you covered
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal stagger>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {promises.map((promise) => (
              <div
                key={promise.label}
                className="text-center group"
              >
                <div className="text-3xl mb-4 group-hover:animate-neon-flicker">
                  {promise.icon}
                </div>
                <h3 className="font-display font-bold text-sm md:text-base neon-text transition-all duration-300">
                  {promise.label}
                </h3>
                <p className="font-mono text-[11px] text-muted mt-1">
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
