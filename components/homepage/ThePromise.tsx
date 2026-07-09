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
    <section ref={sectionRef} className="relative z-[2] border-y-[4px] border-[#E9E1D4] bg-[#15110F]">
      <div className="px-4 py-8 md:py-10">
        {visible ? (
          <SplitFlap
            value="FREE SHIPPING / THIRTY-DAY RETURNS / TRACKED DELIVERY"
            fontSize="clamp(0.7rem, 1.8vw, 1rem)"
            shrinkToFit
          />
        ) : (
          <div className="h-[1.1em]" style={{ fontSize: "clamp(0.7rem, 1.8vw, 1rem)" }} />
        )}
      </div>
    </section>
  );
}
