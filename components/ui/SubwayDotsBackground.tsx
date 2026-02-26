"use client";

import { useRef, useEffect, useCallback } from "react";
import { gsap } from "@/lib/gsap";

// MTA palette — the 8 iconic line colors
const MTA_COLORS = [
  "#EE352E", // Red (1/2/3)
  "#2850AD", // Blue (A/C/E)
  "#FF6319", // Orange (B/D/F/M)
  "#00933C", // Green (4/5/6)
  "#FCCC0A", // Yellow (N/Q/R/W)
  "#B933AD", // Purple (7)
  "#6CBE45", // Lime (G)
  "#A7A9AC", // Gray (S)
];

interface Dot {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  speed: number;
  progress: number; // 0-1 along path
  pathIndex: number;
}

interface BezierPath {
  points: { x: number; y: number }[];
}

/** Generate a set of invisible bezier routes across the viewport */
function generatePaths(w: number, h: number): BezierPath[] {
  return [
    // Horizontal routes
    {
      points: [
        { x: -50, y: h * 0.15 },
        { x: w * 0.3, y: h * 0.12 },
        { x: w * 0.7, y: h * 0.18 },
        { x: w + 50, y: h * 0.14 },
      ],
    },
    {
      points: [
        { x: w + 50, y: h * 0.45 },
        { x: w * 0.65, y: h * 0.42 },
        { x: w * 0.35, y: h * 0.48 },
        { x: -50, y: h * 0.44 },
      ],
    },
    {
      points: [
        { x: -50, y: h * 0.75 },
        { x: w * 0.25, y: h * 0.72 },
        { x: w * 0.75, y: h * 0.78 },
        { x: w + 50, y: h * 0.74 },
      ],
    },
    // Diagonal routes
    {
      points: [
        { x: -50, y: h * 0.05 },
        { x: w * 0.3, y: h * 0.3 },
        { x: w * 0.6, y: h * 0.6 },
        { x: w + 50, y: h * 0.95 },
      ],
    },
    {
      points: [
        { x: w + 50, y: h * 0.1 },
        { x: w * 0.7, y: h * 0.35 },
        { x: w * 0.4, y: h * 0.65 },
        { x: -50, y: h * 0.9 },
      ],
    },
    // Vertical-ish routes
    {
      points: [
        { x: w * 0.2, y: -50 },
        { x: w * 0.18, y: h * 0.35 },
        { x: w * 0.22, y: h * 0.65 },
        { x: w * 0.19, y: h + 50 },
      ],
    },
    {
      points: [
        { x: w * 0.8, y: h + 50 },
        { x: w * 0.82, y: h * 0.6 },
        { x: w * 0.78, y: h * 0.4 },
        { x: w * 0.81, y: -50 },
      ],
    },
    // Express curve routes
    {
      points: [
        { x: -50, y: h * 0.3 },
        { x: w * 0.4, y: h * 0.15 },
        { x: w * 0.6, y: h * 0.55 },
        { x: w + 50, y: h * 0.35 },
      ],
    },
    {
      points: [
        { x: w * 0.5, y: -50 },
        { x: w * 0.35, y: h * 0.25 },
        { x: w * 0.65, y: h * 0.75 },
        { x: w * 0.5, y: h + 50 },
      ],
    },
    {
      points: [
        { x: -50, y: h * 0.6 },
        { x: w * 0.2, y: h * 0.55 },
        { x: w * 0.8, y: h * 0.65 },
        { x: w + 50, y: h * 0.58 },
      ],
    },
  ];
}

/** Evaluate a cubic bezier at parameter t (0-1) */
function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/** Create a dot with randomized properties */
function createDot(pathCount: number): Dot {
  const pathIndex = Math.floor(Math.random() * pathCount);
  return {
    x: 0,
    y: 0,
    radius: 4 + Math.random() * 4, // 4-8px
    color: MTA_COLORS[Math.floor(Math.random() * MTA_COLORS.length)],
    opacity: 0.3 + Math.random() * 0.3, // 0.3-0.6
    speed: 0.0002 + Math.random() * 0.0008, // progress per frame (0.0002-0.001)
    progress: Math.random(), // random start position on path
    pathIndex,
  };
}

const DOT_COUNT = 35;

export function SubwayDotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pathsRef = useRef<BezierPath[]>([]);
  const reducedMotionRef = useRef(false);
  const tickerIdRef = useRef<(() => void) | null>(null);

  const initDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w;
    canvas.height = h;

    pathsRef.current = generatePaths(w, h);
    dotsRef.current = Array.from({ length: DOT_COUNT }, () =>
      createDot(pathsRef.current.length)
    );

    // Set initial positions
    dotsRef.current.forEach((dot) => {
      const path = pathsRef.current[dot.pathIndex];
      if (path) {
        const [p0, p1, p2, p3] = path.points;
        const pos = bezierPoint(p0, p1, p2, p3, dot.progress);
        dot.x = pos.x;
        dot.y = pos.y;
      }
    });
  }, []);

  useEffect(() => {
    // Check reduced motion preference
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handleChange);

    // Initialize
    initDots();

    // Canvas render loop via GSAP ticker
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      dotsRef.current.forEach((dot) => {
        // Move dot along its path (unless reduced motion)
        if (!reducedMotionRef.current) {
          dot.progress += dot.speed;
          if (dot.progress > 1) {
            dot.progress = 0;
            // Optionally switch to a different path
            if (Math.random() < 0.3) {
              dot.pathIndex = Math.floor(
                Math.random() * pathsRef.current.length
              );
            }
          }
        }

        const path = pathsRef.current[dot.pathIndex];
        if (path) {
          const [p0, p1, p2, p3] = path.points;
          const pos = bezierPoint(p0, p1, p2, p3, dot.progress);
          dot.x = pos.x;
          dot.y = pos.y;
        }

        // Draw dot with radial gradient glow
        const gradient = ctx.createRadialGradient(
          dot.x,
          dot.y,
          0,
          dot.x,
          dot.y,
          dot.radius * 2.5
        );
        gradient.addColorStop(0, dot.color);
        gradient.addColorStop(0.4, dot.color);
        gradient.addColorStop(1, "transparent");

        ctx.globalAlpha = dot.opacity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
    };

    gsap.ticker.add(render);
    tickerIdRef.current = render;

    // Handle resize (debounced)
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        initDots();
      }, 200);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (tickerIdRef.current) {
        gsap.ticker.remove(tickerIdRef.current);
      }
      mq.removeEventListener("change", handleChange);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [initDots]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] pointer-events-none"
      aria-hidden="true"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
