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
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="relative">
      {/* Subway tile frame */}
      <div className="subway-tiles p-2 md:p-3">
        {/* Mosaic image container */}
        <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden noise-overlay">
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

          {/* Scroll-driven dark overlay */}
          <div
            ref={overlayRef}
            className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent opacity-0 z-10"
          />
        </div>
      </div>

      {/* Platform edge safety stripe */}
      <div className="platform-edge" />

      {/* Split-flap departure board */}
      <div className="bg-[#0a0a0a] py-6 md:py-8 flex justify-center overflow-hidden">
        <SplitFlap
          value={MESSAGES[messageIndex]}
          fontSize="clamp(0.75rem, 2vw, 1.25rem)"
          staggerDelay={20}
        />
      </div>

      {/* Second platform edge */}
      <div className="platform-edge" />
    </section>
  );
}

export default Entrance;
