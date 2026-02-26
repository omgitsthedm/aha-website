"use client";

import { useRef, useState } from "react";
import { SplitFlap } from "@/components/ui/SplitFlap";
import { gsap, useGSAP } from "@/lib/gsap";

export function ThePromise() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Trigger the SplitFlap animation when scrolled into view
      gsap.to(sectionRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 90%",
          once: true,
          onEnter: () => setVisible(true),
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative z-[2] bg-[#0a0a0a] border-t border-b border-white/[0.06]">
      <div className="py-10 md:py-14 flex justify-center overflow-x-auto">
        {visible ? (
          <SplitFlap
            value="FREE SHIPPING $75+ · 30-DAY RETURNS · TRACKED DELIVERY"
            fontSize="clamp(0.7rem, 1.8vw, 1rem)"
          />
        ) : (
          <div className="h-[1.1em]" style={{ fontSize: "clamp(0.7rem, 1.8vw, 1rem)" }} />
        )}
      </div>
    </section>
  );
}
