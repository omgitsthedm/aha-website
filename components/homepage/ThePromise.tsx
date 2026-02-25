"use client";

import { useRef, useState } from "react";
import { WhiteBand } from "@/components/ui/WhiteBand";
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
    <section ref={sectionRef} className="py-6 px-6 bg-void">
      <WhiteBand />
      <div className="flex justify-center py-6 overflow-x-auto">
        {visible ? (
          <SplitFlap
            value="FREE SHIP $75+ · 30-DAY RETURNS · TRACKED"
            fontSize="clamp(0.6rem, 1.5vw, 0.9rem)"
          />
        ) : (
          <div className="h-[1.1em]" style={{ fontSize: "clamp(0.6rem, 1.5vw, 0.9rem)" }} />
        )}
      </div>
      <WhiteBand />
    </section>
  );
}
