"use client";

import { useEffect, useState } from "react";

export function Entrance() {
  const [loaded, setLoaded] = useState(false);
  const [lettersVisible, setLettersVisible] = useState(0);

  const brandName = "AFTER HOURS AGENDA";

  useEffect(() => {
    const startDelay = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(startDelay);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (lettersVisible >= brandName.length) return;

    const timer = setTimeout(() => {
      setLettersVisible((prev) => prev + 1);
    }, 60);

    return () => clearTimeout(timer);
  }, [loaded, lettersVisible, brandName.length]);

  return (
    <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Minimal background */}
      <div className="absolute inset-0 bg-void" />

      {/* Brand name — letter by letter */}
      <h1 className="relative z-10 font-display font-extrabold text-hero text-center tracking-tight select-none">
        {brandName.split("").map((letter, i) => (
          <span
            key={i}
            className={`inline-block transition-all duration-300 ${
              i < lettersVisible
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 translate-y-4 blur-sm"
            }`}
            style={{
              color: i < lettersVisible ? "#E8E4DD" : "transparent",
            }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        ))}
      </h1>

      {/* Tagline */}
      <p
        className={`relative z-10 mt-6 font-body text-muted text-sm tracking-[0.1em] uppercase transition-all duration-1000 delay-[1500ms] ${
          lettersVisible >= brandName.length
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }`}
      >
        New York &mdash; Est. 2024
      </p>

      {/* Minimal scroll indicator */}
      <div
        className={`absolute bottom-12 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-[2200ms] ${
          lettersVisible >= brandName.length
            ? "opacity-40"
            : "opacity-0"
        }`}
      >
        <svg
          className="w-4 h-4 text-cream animate-breathe"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    </section>
  );
}
