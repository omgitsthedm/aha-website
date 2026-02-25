"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·:$-+!?'";

interface SplitFlapProps {
  value: string;
  fontSize?: string;
  className?: string;
  staggerDelay?: number;
}

function FlapCell({
  targetChar,
  delay,
  fontSize,
}: {
  targetChar: string;
  delay: number;
  fontSize: string;
}) {
  const [displayChar, setDisplayChar] = useState(" ");
  const [isFlipping, setIsFlipping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flipChainRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const target = targetChar.toUpperCase();
    const current = displayChar;

    // Skip if already showing the right character
    if (target === current) return;

    const targetIdx = CHARS.indexOf(target);
    const currentIdx = CHARS.indexOf(current);

    // If target character is not in our set, just set it directly
    if (targetIdx === -1) {
      setDisplayChar(target);
      return;
    }

    // Build the sequence of characters to flip through
    const steps: string[] = [];

    if (targetIdx > currentIdx) {
      for (let i = currentIdx + 1; i <= targetIdx; i++) {
        steps.push(CHARS[i]);
      }
    } else if (targetIdx < currentIdx) {
      // Wrap around through the character set
      for (let i = currentIdx + 1; i < CHARS.length; i++) steps.push(CHARS[i]);
      for (let i = 0; i <= targetIdx; i++) steps.push(CHARS[i]);
    }

    // Limit to a reasonable number of steps for performance
    const limitedSteps =
      steps.length > 10
        ? [...steps.slice(0, 3), ...steps.slice(-3), target]
        : steps;

    // Start the flip sequence after the stagger delay
    let stepIndex = 0;

    const flipNext = () => {
      if (stepIndex >= limitedSteps.length) {
        setIsFlipping(false);
        return;
      }
      setIsFlipping(true);
      setDisplayChar(limitedSteps[stepIndex]);
      stepIndex++;
      flipChainRef.current = setTimeout(flipNext, 50 + Math.random() * 30);
    };

    timeoutRef.current = setTimeout(() => flipNext(), delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (flipChainRef.current) clearTimeout(flipChainRef.current);
    };
  }, [targetChar]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = displayChar === " ";

  return (
    <div
      className="inline-flex items-center justify-center rounded-sm overflow-hidden relative"
      style={{
        width: `calc(${fontSize} * 0.65)`,
        height: `calc(${fontSize} * 1.1)`,
        fontSize,
        perspective: "200px",
        background: "#1A1A1A",
      }}
    >
      {/* Top half */}
      <div
        className="absolute top-0 left-0 right-0 h-1/2 overflow-hidden flex items-end justify-center"
        style={{
          background: "#1e1e1e",
          borderBottom: "1px solid rgba(0,0,0,0.6)",
        }}
      >
        {!isEmpty && (
          <span
            className="text-cream font-mono font-medium translate-y-[50%]"
            style={{ lineHeight: 0 }}
          >
            {displayChar}
          </span>
        )}
      </div>

      {/* Bottom half */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden flex items-start justify-center"
        style={{ background: "#1A1A1A" }}
      >
        {!isEmpty && (
          <span
            className="text-cream font-mono font-medium -translate-y-[50%]"
            style={{ lineHeight: 0 }}
          >
            {displayChar}
          </span>
        )}
      </div>

      {/* Center dividing line */}
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/40 z-10" />

      {/* Subtle shadow overlay when flipping */}
      {isFlipping && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent z-20 pointer-events-none" />
      )}
    </div>
  );
}

export function SplitFlap({
  value,
  fontSize = "2rem",
  className = "",
  staggerDelay = 40,
}: SplitFlapProps) {
  const chars = value.toUpperCase().split("");

  return (
    <div
      className={`inline-flex gap-[2px] ${className}`}
      role="text"
      aria-label={value}
    >
      {chars.map((char, i) => (
        <FlapCell
          key={i}
          targetChar={char}
          delay={i * staggerDelay}
          fontSize={fontSize}
        />
      ))}
    </div>
  );
}

export default SplitFlap;
