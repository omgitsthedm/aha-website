"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SplitFlap } from "@/components/ui/SplitFlap";

const MESSAGES = [
  "NOW SERVING · BLACK SHEEP · NO KINGS · NIGHT MODE",
  "NYC FOREVER · NEW ARRIVALS · FREE SHIP $75+",
  "BUILT FOR THE ONES STILL MOVING",
  "EVERYTHING IS AFTER HOURS",
];

export function Entrance() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through split-flap messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // GSAP scroll-driven animations
  useGSAP(
    () => {
      if (!imageRef.current || !overlayRef.current) return;

      // Parallax on the mosaic image (0.3x speed) + slight scale-down
      gsap.to(imageRef.current, {
        yPercent: 30,
        scale: 0.95,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Dark gradient overlay fades in as you scroll past 30%
      gsap.to(overlayRef.current, {
        opacity: 0.7,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "30% top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Scroll indicator fades out as user scrolls
      if (scrollIndicatorRef.current) {
        gsap.to(scrollIndicatorRef.current, {
          opacity: 0,
          y: -10,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "15% top",
            scrub: true,
          },
        });
      }
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="relative">
      {/* Subway tile frame */}
      <div className="subway-tiles p-2 md:p-3">
        {/* Mosaic image container with inner shadow */}
        <div
          className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden noise-overlay"
          style={{
            boxShadow:
              "inset 0 0 60px rgba(0, 0, 0, 0.5), inset 0 0 120px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            ref={imageRef}
            className="absolute inset-0 will-change-transform"
          >
            <Image
              src="/brand/mosaic-hero.png"
              alt="After Hours Agenda — NYC subway mosaic with black sheep"
              fill
              className="object-cover object-center"
              sizes="100vw"
              priority
              quality={90}
            />
          </div>

          {/* Centered overlay text on the mosaic */}
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center pointer-events-none">
            <h1
              className="font-display font-black text-white/80 uppercase text-center leading-none mix-blend-overlay select-none"
              style={{
                fontSize: "clamp(2rem, 8vw, 7rem)",
                letterSpacing: "0.15em",
              }}
            >
              After Hours
              <br />
              Agenda
            </h1>
            <span
              className="font-mono text-white/50 uppercase mt-4 select-none"
              style={{
                fontSize: "clamp(0.6rem, 1.2vw, 0.85rem)",
                letterSpacing: "0.3em",
              }}
            >
              Est. New York
            </span>
          </div>

          {/* Scroll-driven dark overlay */}
          <div
            ref={overlayRef}
            className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent opacity-0 z-10"
          />

          {/* Scroll to enter indicator */}
          <div
            ref={scrollIndicatorRef}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[15] flex flex-col items-center gap-2"
          >
            <span
              className="font-mono text-white/60 uppercase"
              style={{
                fontSize: "clamp(0.5rem, 0.9vw, 0.65rem)",
                letterSpacing: "0.25em",
              }}
            >
              Scroll to Enter
            </span>
            <span className="text-white/40 text-sm animate-bounce">
              &#8595;
            </span>
          </div>
        </div>
      </div>

      {/* Platform edge safety stripe */}
      <div className="platform-edge" />

      {/* Split-flap departure board — refined with borders and label */}
      <div className="bg-[#0a0a0a] border-t border-b border-white/[0.06]">
        <div className="py-8 md:py-10 flex flex-col items-center gap-3 overflow-hidden">
          <span
            className="font-mono text-[#E8E4DE]/30 uppercase block"
            style={{
              fontSize: "clamp(0.45rem, 0.7vw, 0.55rem)",
              letterSpacing: "0.35em",
            }}
          >
            Service Status
          </span>
          <SplitFlap
            value={MESSAGES[messageIndex]}
            fontSize="clamp(0.75rem, 2vw, 1.25rem)"
            staggerDelay={20}
          />
        </div>
      </div>

      {/* Second platform edge */}
      <div className="platform-edge" />
    </section>
  );
}

export default Entrance;
