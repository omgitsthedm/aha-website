"use client";

import { useEffect, useRef, useState } from "react";

const manifestoLines = [
  "For the ones who stay out late.",
  "For the ones who think different.",
  "For the ones who walk their own path.",
  "For the ones who write their own agenda.",
];

export function Agenda() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visibleLines, setVisibleLines] = useState<Set<number>>(new Set());

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const lines = section.querySelectorAll("[data-line]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.line
            );
            setVisibleLines((prev) => {
              const next = new Set(Array.from(prev));
              next.add(index);
              return next;
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5, rootMargin: "0px 0px -10% 0px" }
    );

    lines.forEach((line) => observer.observe(line));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 md:py-48 px-6"
    >
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
        {manifestoLines.map((line, i) => (
          <p
            key={i}
            data-line={i}
            className={`font-display font-bold text-chapter transition-all duration-1000 ${
              visibleLines.has(i)
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionDelay: `${i * 150}ms`,
              color:
                i === manifestoLines.length - 1 ? "#D4A853" : "#E8E4DD",
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
