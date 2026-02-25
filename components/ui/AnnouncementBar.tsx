"use client";

import { useState, useEffect } from "react";

const MESSAGES = [
  "FREE SHIPPING ON ORDERS $75+",
  "TRACKED DELIVERY",
  "30-DAY RETURNS",
];

const FULL_LINE = MESSAGES.join("  \u00b7  ");

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
    <div className="bg-void border-b border-white/10">
      <div className="px-4 py-2 flex items-center justify-center">
        {/* Desktop — all messages on one line */}
        <p className="hidden sm:block font-mono text-[11px] text-muted tracking-[0.15em] text-center uppercase">
          {FULL_LINE}
        </p>

        {/* Mobile — cycle messages with instant swap */}
        <p className="block sm:hidden font-mono text-[11px] text-muted tracking-[0.15em] text-center uppercase">
          {MESSAGES[index]}
        </p>
      </div>
    </div>
  );
}

export default AnnouncementBar;
