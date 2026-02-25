"use client";

import { useEffect, useState } from "react";

export function Entrance() {
  const [loaded, setLoaded] = useState(false);
  const [lettersVisible, setLettersVisible] = useState(0);

  const brandName = "AFTER HOURS AGENDA";

  useEffect(() => {
    // Start letter-by-letter reveal after a short delay
    const startDelay = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(startDelay);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (lettersVisible >= brandName.length) return;

    const timer = setTimeout(() => {
      setLettersVisible((prev) => prev + 1);
    }, 60); // 60ms per letter

    return () => clearTimeout(timer);
  }, [loaded, lettersVisible, brandName.length]);

  return (
    <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-void">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-glow-faint via-transparent to-transparent opacity-60" />
      </div>

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
              textShadow:
                i < lettersVisible
                  ? "0 0 40px rgba(212, 168, 83, 0.15)"
                  : "none",
            }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        ))}
      </h1>

      {/* Tagline */}
      <p
        className={`relative z-10 mt-6 font-body text-muted text-sm md:text-base tracking-wide transition-all duration-1000 delay-[1500ms] ${
          lettersVisible >= brandName.length
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }`}
      >
        NYC Streetwear &mdash; Est. 2024
      </p>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-1000 delay-[2000ms] ${
          lettersVisible >= brandName.length
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        <span className="font-mono text-[10px] text-muted tracking-[0.3em] uppercase">
          Scroll to enter
        </span>
        <svg
          className="w-4 h-4 text-glow animate-breathe"
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
