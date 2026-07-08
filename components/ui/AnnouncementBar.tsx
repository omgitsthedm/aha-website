"use client";

import { useState, useEffect } from "react";

const MESSAGES = [
  "Free Shipping $75+",
  "Made to Order",
  "Thirty-Day Returns",
];

const FULL_LINE = MESSAGES.join("  /  ");

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  // Cycle messages on mobile (instant swap, no fade)
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative z-[60] bg-[#CCFF00] text-[#10100F] border-b-[3px] border-[#10100F]">
      <div className="px-4 py-2 flex items-center justify-center">
        {/* Desktop — all messages on one line */}
        <p className="hidden sm:block font-body font-bold text-[12px] tracking-[0.12em] text-center uppercase">
          {FULL_LINE}
        </p>

        {/* Mobile — cycle messages with instant swap */}
        <p className="block sm:hidden font-body font-bold text-xs tracking-[0.1em] text-center uppercase">
          {MESSAGES[index]}
        </p>
      </div>
    </div>
  );
}

export default AnnouncementBar;
