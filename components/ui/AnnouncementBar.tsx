"use client";

import { useState, useEffect } from "react";

const messages = [
  "FREE SHIPPING ON ORDERS $75+",
  "TRACKED SHIPPING ON ALL ORDERS",
  "30-DAY EASY RETURNS",
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-void py-2 text-center">
      <p
        className={`font-mono text-[11px] text-muted tracking-[0.1em] transition-opacity duration-300 ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {messages[index]}
      </p>
    </div>
  );
}
